'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Copy, Download, Eye, EyeOff, Loader2, RefreshCw, Unplug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils';

interface Status {
  configured: boolean;
  connected?: boolean;
  host?: string;
  source?: 'saved' | 'env';
  userName?: string | null;
  error?: string;
}
interface Course {
  id: string;
  name: string;
  courseCode: string | null;
  term: string | null;
}
interface CourseContent {
  title: string;
  markdown: string;
  truncated: boolean;
}
interface CanvasFile {
  id: string;
  name: string;
  size: number | null;
  contentType: string | null;
}

const PRESETS = [
  { id: 'lms', url: 'https://lms.korea.ac.kr', label: 'lms.korea.ac.kr' },
  { id: 'mylms', url: 'https://mylms.korea.ac.kr', label: 'mylms.korea.ac.kr' },
];

const STRINGS = {
  ko: {
    intro: '학교 Canvas 계정을 연결하면 강의 자료와 파일을 수업 생성에 활용할 수 있습니다.',
    server: 'Canvas 서버',
    custom: '직접 입력',
    token: '액세스 토큰',
    tokenPlaceholder: '발급받은 토큰을 붙여 넣으세요',
    show: '토큰 표시',
    hide: '토큰 숨기기',
    save: '저장하고 연결 확인',
    saving: '확인 중...',
    disconnect: '연결 해제',
    howTo: '토큰 발급: Canvas 로그인 > 계정 > 설정 > 승인된 통합 > + 새 액세스 토큰. 학교 정책으로 막혀 있으면 관리자에게 문의하세요.',
    security: '토큰은 이 브라우저의 보안 쿠키(HttpOnly)에 저장되며 화면에 다시 표시되지 않습니다.',
    connectedAs: '연결됨',
    envNote: '서버 환경변수로 연결되어 있습니다. 아래에서 개인 토큰을 저장하면 그 토큰이 우선 사용됩니다.',
    notConnected: '아직 연결되지 않았습니다.',
    failed: '연결에 실패했습니다.',
    courses: '내 강의',
    refresh: '새로고침',
    noCourses: '진행 중인 강의가 없습니다.',
    loading: '불러오는 중...',
    textTab: '강의 텍스트',
    filesTab: '파일',
    copy: '복사',
    copied: '복사됨',
    download: '.md 저장',
    truncated: '내용이 길어 일부만 가져왔습니다.',
    noFiles: '이 강의에는 가져올 파일이 없습니다.',
    importSelected: '선택한 파일 가져오기',
    importHint: '가져온 파일은 자료실에 저장되어 수업 생성에 사용할 수 있습니다.',
    selectAll: '전체 선택',
    working: '가져오는 중',
    done: '완료',
    pickCourse: '강의를 선택하세요.',
  },
  en: {
    intro: 'Connect your school Canvas account to use course material and files when generating lessons.',
    server: 'Canvas server',
    custom: 'Custom',
    token: 'Access token',
    tokenPlaceholder: 'Paste your token',
    show: 'Show token',
    hide: 'Hide token',
    save: 'Save and verify',
    saving: 'Verifying...',
    disconnect: 'Disconnect',
    howTo: 'Get a token: Canvas > Account > Settings > Approved Integrations > + New Access Token. Ask your administrator if your school blocks it.',
    security: 'The token is kept in a secure HttpOnly cookie in this browser and is never shown again.',
    connectedAs: 'Connected',
    envNote: 'Connected through server configuration. A personal token saved below takes precedence.',
    notConnected: 'Not connected yet.',
    failed: 'Connection failed.',
    courses: 'My courses',
    refresh: 'Refresh',
    noCourses: 'No active courses.',
    loading: 'Loading...',
    textTab: 'Course text',
    filesTab: 'Files',
    copy: 'Copy',
    copied: 'Copied',
    download: 'Save .md',
    truncated: 'The content was long, so only part of it was fetched.',
    noFiles: 'This course has no files to import.',
    importSelected: 'Import selected files',
    importHint: 'Imported files are stored in your materials library and can be used for lesson generation.',
    selectAll: 'Select all',
    working: 'Importing',
    done: 'Done',
    pickCourse: 'Select a course.',
  },
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error((body && (body.error as string)) || 'HTTP ' + res.status);
  return body as T;
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function formatSize(bytes: number | null): string {
  if (bytes == null) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

export function CanvasSettings() {
  const i18n = useI18n() as unknown as { locale?: string };
  const [isKo, setIsKo] = useState(true);
  useEffect(() => {
    const locale = i18n.locale || document.documentElement.lang || navigator.language || 'ko';
    setIsKo(locale.toLowerCase().startsWith('ko'));
  }, [i18n.locale]);
  const s = isKo ? STRINGS.ko : STRINGS.en;

  const [status, setStatus] = useState<Status | null>(null);
  const [preset, setPreset] = useState('lms');
  const [customUrl, setCustomUrl] = useState('');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [courses, setCourses] = useState<Course[] | null>(null);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [tab, setTab] = useState<'text' | 'files'>('text');
  const [content, setContent] = useState<CourseContent | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [files, setFiles] = useState<CanvasFile[] | null>(null);
  const [filesLoading, setFilesLoading] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [imports, setImports] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);

  const connected = !!status?.connected;

  const loadCourses = useCallback(async () => {
    setCoursesLoading(true);
    setPanelError(null);
    try {
      const data = await api<{ courses: Course[] }>('/api/canvas/courses');
      setCourses(data.courses);
    } catch (e) {
      setCourses([]);
      setPanelError(errText(e));
    } finally {
      setCoursesLoading(false);
    }
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const data = await api<Status>('/api/canvas/status');
      setStatus(data);
      if (data.host) {
        const match = PRESETS.find((p) => p.label === data.host);
        if (match) setPreset(match.id);
        else {
          setPreset('custom');
          setCustomUrl('https://' + data.host);
        }
      }
      if (data.connected) void loadCourses();
    } catch {
      setStatus({ configured: false });
    }
  }, [loadCourses]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const selectedBase =
    preset === 'custom' ? customUrl : (PRESETS.find((p) => p.id === preset)?.url ?? '');

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const data = await api<Status>('/api/canvas/settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ baseUrl: selectedBase, token }),
      });
      setToken('');
      setStatus(data);
      void loadCourses();
    } catch (e) {
      setError(errText(e));
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    await fetch('/api/canvas/settings', { method: 'DELETE' }).catch(() => undefined);
    setCourses(null);
    setCourseId(null);
    setContent(null);
    setFiles(null);
    await loadStatus();
  }

  function openCourse(id: string) {
    setCourseId(id);
    setContent(null);
    setFiles(null);
    setPicked(new Set());
    setImports({});
    setPanelError(null);
    setContentLoading(true);
    setFilesLoading(true);
    api<CourseContent>('/api/canvas/courses/' + id + '/content')
      .then(setContent)
      .catch((e) => setPanelError(errText(e)))
      .finally(() => setContentLoading(false));
    api<{ files: CanvasFile[] }>('/api/canvas/courses/' + id + '/files')
      .then((d) => setFiles(d.files))
      .catch((e) => {
        setFiles([]);
        setPanelError(errText(e));
      })
      .finally(() => setFilesLoading(false));
  }

  async function copyContent() {
    if (!content) return;
    await navigator.clipboard.writeText(content.markdown).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function downloadContent() {
    if (!content) return;
    const blob = new Blob([content.markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = content.title.split('/').join('_') + '.md';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importOne(file: CanvasFile) {
    const dl = await fetch('/api/canvas/files/' + file.id + '/download');
    if (!dl.ok) {
      const b = await dl.json().catch(() => null);
      throw new Error((b && b.error) || 'HTTP ' + dl.status);
    }
    const blob = await dl.blob();
    const headers = {
      'content-type': file.contentType || blob.type || 'application/octet-stream',
      'x-material-filename': encodeURIComponent(file.name),
    };
    let up = await fetch('/api/materials?scope=library', { method: 'POST', headers, body: blob });
    if (up.status === 404) up = await fetch('/api/materials', { method: 'POST', headers, body: blob });
    if (!up.ok) {
      const b = await up.json().catch(() => null);
      throw new Error((b && b.error) || 'HTTP ' + up.status);
    }
  }

  async function importSelected() {
    if (!files) return;
    setImporting(true);
    for (const file of files.filter((f) => picked.has(f.id))) {
      setImports((prev) => ({ ...prev, [file.id]: 'working' }));
      try {
        await importOne(file);
        setImports((prev) => ({ ...prev, [file.id]: 'done' }));
      } catch (e) {
        setImports((prev) => ({ ...prev, [file.id]: errText(e) }));
      }
    }
    setImporting(false);
  }

  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allPicked = !!files && files.length > 0 && picked.size === files.length;

  return (
    <div className="max-w-3xl space-y-6">
      <p className="text-sm text-muted-foreground">{s.intro}</p>

      <div
        role="status"
        className={cn(
          'flex items-start gap-2 rounded-lg border p-3 text-sm',
          connected ? 'border-green-500/40 bg-green-500/5' : 'bg-muted/30',
        )}
      >
        {connected ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
        ) : (
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          {status === null ? (
            <span>{s.loading}</span>
          ) : connected ? (
            <>
              <div className="font-medium">
                {s.connectedAs}: {status.host}
                {status.userName ? ' / ' + status.userName : ''}
              </div>
              {status.source === 'env' && (
                <div className="text-xs text-muted-foreground">{s.envNote}</div>
              )}
            </>
          ) : status.configured ? (
            <span>
              {s.failed} {status.error}
            </span>
          ) : (
            <span>{s.notConnected}</span>
          )}
        </div>
        {status?.source === 'saved' && (
          <Button variant="outline" size="sm" onClick={() => void disconnect()}>
            <Unplug className="mr-1 h-3.5 w-3.5" />
            {s.disconnect}
          </Button>
        )}
      </div>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!saving && token.trim()) void save();
        }}
      >
        <div className="space-y-2">
          <Label>{s.server}</Label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button
                key={p.id}
                type="button"
                size="sm"
                variant={preset === p.id ? 'default' : 'outline'}
                onClick={() => setPreset(p.id)}
              >
                {p.label}
              </Button>
            ))}
            <Button
              type="button"
              size="sm"
              variant={preset === 'custom' ? 'default' : 'outline'}
              onClick={() => setPreset('custom')}
            >
              {s.custom}
            </Button>
          </div>
          {preset === 'custom' && (
            <Input
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="https://yourschool.instructure.com"
              autoComplete="off"
              spellCheck={false}
            />
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="canvas-token">{s.token}</Label>
          <div className="flex gap-2">
            <Input
              id="canvas-token"
              name="canvas-access-token"
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={s.tokenPlaceholder}
              autoComplete="off"
              spellCheck={false}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={showToken ? s.hide : s.show}
              onClick={() => setShowToken((v) => !v)}
            >
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{s.howTo}</p>
          <p className="text-xs text-muted-foreground">{s.security}</p>
        </div>

        {error && (
          <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        <Button type="submit" disabled={saving || !token.trim() || !selectedBase.trim()}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {saving ? s.saving : s.save}
        </Button>
      </form>

      {connected && (
        <div className="space-y-3 border-t pt-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{s.courses}</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void loadCourses()}
              disabled={coursesLoading}
            >
              <RefreshCw className={cn('mr-1 h-3.5 w-3.5', coursesLoading && 'animate-spin')} />
              {s.refresh}
            </Button>
          </div>

          {coursesLoading && !courses && <p className="text-sm text-muted-foreground">{s.loading}</p>}
          {courses && courses.length === 0 && !coursesLoading && (
            <p className="text-sm text-muted-foreground">{s.noCourses}</p>
          )}
          {courses && courses.length > 0 && (
            <ul className="grid gap-2 sm:grid-cols-2">
              {courses.map((course) => (
                <li key={course.id}>
                  <button
                    type="button"
                    onClick={() => openCourse(course.id)}
                    aria-pressed={courseId === course.id}
                    className={cn(
                      'w-full rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted',
                      courseId === course.id && 'border-primary bg-primary/5',
                    )}
                  >
                    <div className="truncate font-medium">{course.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {[course.courseCode, course.term].filter(Boolean).join(' / ')}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {panelError && (
            <p role="alert" className="text-sm text-destructive">
              {panelError}
            </p>
          )}

          {!courseId && courses && courses.length > 0 && (
            <p className="text-sm text-muted-foreground">{s.pickCourse}</p>
          )}

          {courseId && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex gap-1" role="tablist">
                <Button
                  role="tab"
                  aria-selected={tab === 'text'}
                  size="sm"
                  variant={tab === 'text' ? 'secondary' : 'ghost'}
                  onClick={() => setTab('text')}
                >
                  {s.textTab}
                </Button>
                <Button
                  role="tab"
                  aria-selected={tab === 'files'}
                  size="sm"
                  variant={tab === 'files' ? 'secondary' : 'ghost'}
                  onClick={() => setTab('files')}
                >
                  {s.filesTab}
                </Button>
              </div>

              {tab === 'text' && (
                <div className="space-y-2">
                  {contentLoading && <p className="text-sm text-muted-foreground">{s.loading}</p>}
                  {content && (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => void copyContent()}>
                          <Copy className="mr-1 h-3.5 w-3.5" />
                          {copied ? s.copied : s.copy}
                        </Button>
                        <Button size="sm" variant="outline" onClick={downloadContent}>
                          <Download className="mr-1 h-3.5 w-3.5" />
                          {s.download}
                        </Button>
                        {content.truncated && (
                          <span className="text-xs text-muted-foreground">{s.truncated}</span>
                        )}
                      </div>
                      <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-xs">
                        {content.markdown}
                      </pre>
                    </>
                  )}
                </div>
              )}

              {tab === 'files' && (
                <div className="space-y-2">
                  {filesLoading && <p className="text-sm text-muted-foreground">{s.loading}</p>}
                  {files && files.length === 0 && !filesLoading && (
                    <p className="text-sm text-muted-foreground">{s.noFiles}</p>
                  )}
                  {files && files.length > 0 && (
                    <>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={allPicked}
                          onChange={() =>
                            setPicked(allPicked ? new Set() : new Set(files.map((f) => f.id)))
                          }
                        />
                        {s.selectAll}
                      </label>
                      <ul className="max-h-72 divide-y overflow-auto rounded-md border">
                        {files.map((file) => {
                          const state = imports[file.id];
                          return (
                            <li key={file.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                              <input
                                type="checkbox"
                                aria-label={file.name}
                                checked={picked.has(file.id)}
                                disabled={importing}
                                onChange={() => togglePick(file.id)}
                              />
                              <span className="min-w-0 flex-1 truncate">{file.name}</span>
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {formatSize(file.size)}
                              </span>
                              {state === 'working' && (
                                <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  {s.working}
                                </span>
                              )}
                              {state === 'done' && (
                                <span className="shrink-0 text-xs text-green-600">{s.done}</span>
                              )}
                              {state && state !== 'working' && state !== 'done' && (
                                <span
                                  className="max-w-[40%] shrink-0 truncate text-xs text-destructive"
                                  title={state}
                                >
                                  {state}
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          size="sm"
                          disabled={importing || picked.size === 0}
                          onClick={() => void importSelected()}
                        >
                          {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {s.importSelected} ({picked.size})
                        </Button>
                        <span className="text-xs text-muted-foreground">{s.importHint}</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
