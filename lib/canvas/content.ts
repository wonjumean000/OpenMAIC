/**
 * Gather a Canvas course's teaching material (syllabus, pages, assignments,
 * modules) into one Markdown document that can seed lesson generation.
 */
import { canvasGet, canvasList } from './client';
import type { CanvasConfig } from './config';
import { htmlToText } from './html-to-text';

export const CANVAS_SECTIONS = ['syllabus', 'pages', 'assignments', 'modules'] as const;
export type CanvasSection = (typeof CANVAS_SECTIONS)[number];

const MAX_PAGES_FETCHED = 15;
const MAX_ASSIGNMENTS = 50;
const MAX_CHARS = 150_000;
const CONCURRENCY = 4;

interface CanvasCourse {
  id: string;
  name: string;
  course_code?: string;
  syllabus_body?: string | null;
}
interface CanvasPageSummary {
  url: string;
  title: string;
  published?: boolean;
}
interface CanvasPage extends CanvasPageSummary {
  body?: string | null;
}
interface CanvasAssignment {
  id: string;
  name: string;
  description?: string | null;
  due_at?: string | null;
  points_possible?: number | null;
}
interface CanvasModuleItem {
  title: string;
  type: string;
  indent?: number;
}
interface CanvasModule {
  id: string;
  name: string;
  items?: CanvasModuleItem[];
}

export interface CanvasCourseSummary {
  id: string;
  name: string;
  courseCode: string | null;
  term: string | null;
}

export interface CanvasCourseContent {
  courseId: string;
  title: string;
  markdown: string;
  sections: CanvasSection[];
  truncated: boolean;
}

export async function listCourses(config: CanvasConfig): Promise<CanvasCourseSummary[]> {
  const courses = await canvasList<{
    id: string;
    name?: string;
    course_code?: string;
    term?: { name?: string };
  }>(config, '/courses', { enrollment_state: 'active', 'include[]': ['term'] });
  return courses
    .filter((course) => course.name)
    .map((course) => ({
      id: String(course.id),
      name: course.name as string,
      courseCode: course.course_code ?? null,
      term: course.term?.name ?? null,
    }));
}

async function mapLimited<T, R>(items: T[], worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    results.push(...(await Promise.all(items.slice(i, i + CONCURRENCY).map(worker))));
  }
  return results;
}

export async function buildCourseContent(
  config: CanvasConfig,
  courseId: string,
  sections: CanvasSection[],
): Promise<CanvasCourseContent> {
  const wanted = new Set(sections);
  const course = await canvasGet<CanvasCourse>(config, `/courses/${courseId}`, {
    'include[]': wanted.has('syllabus') ? ['syllabus_body'] : undefined,
  });
  const parts: string[] = [`# ${course.name}${course.course_code ? ` (${course.course_code})` : ''}`];

  if (wanted.has('syllabus')) {
    const syllabus = htmlToText(course.syllabus_body);
    if (syllabus) parts.push(`## Syllabus\n\n${syllabus}`);
  }

  if (wanted.has('modules')) {
    const modules = await canvasList<CanvasModule>(config, `/courses/${courseId}/modules`, {
      'include[]': ['items'],
    });
    if (modules.length > 0) {
      const lines = modules.map((module) => {
        const items = (module.items ?? []).map(
          (item) => `${'  '.repeat(item.indent ?? 0)}- ${item.title} (${item.type})`,
        );
        return [`### ${module.name}`, ...items].join('\n');
      });
      parts.push(`## Modules\n\n${lines.join('\n\n')}`);
    }
  }

  if (wanted.has('pages')) {
    const summaries = (
      await canvasList<CanvasPageSummary>(config, `/courses/${courseId}/pages`, { sort: 'title' })
    )
      .filter((page) => page.published !== false)
      .slice(0, MAX_PAGES_FETCHED);
    const pages = await mapLimited(summaries, (summary) =>
      canvasGet<CanvasPage>(config, `/courses/${courseId}/pages/${encodeURIComponent(summary.url)}`),
    );
    const rendered = pages
      .map((page) => ({ title: page.title, text: htmlToText(page.body) }))
      .filter((page) => page.text)
      .map((page) => `### ${page.title}\n\n${page.text}`);
    if (rendered.length > 0) parts.push(`## Pages\n\n${rendered.join('\n\n')}`);
  }

  if (wanted.has('assignments')) {
    const assignments = (
      await canvasList<CanvasAssignment>(config, `/courses/${courseId}/assignments`)
    ).slice(0, MAX_ASSIGNMENTS);
    const rendered = assignments.map((assignment) => {
      const meta = [
        assignment.due_at ? `due ${assignment.due_at}` : null,
        assignment.points_possible != null ? `${assignment.points_possible} pts` : null,
      ]
        .filter(Boolean)
        .join(', ');
      const body = htmlToText(assignment.description);
      return `### ${assignment.name}${meta ? ` (${meta})` : ''}${body ? `\n\n${body}` : ''}`;
    });
    if (rendered.length > 0) parts.push(`## Assignments\n\n${rendered.join('\n\n')}`);
  }

  let markdown = parts.join('\n\n');
  let truncated = false;
  if (markdown.length > MAX_CHARS) {
    markdown = markdown.slice(0, MAX_CHARS);
    truncated = true;
  }
  return { courseId, title: course.name, markdown, sections, truncated };
}
