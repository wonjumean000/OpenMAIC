/**
 * Minimal Canvas LMS REST client (https://developerdocs.instructure.com/services/canvas).
 *
 * - Bearer auth in the Authorization header (never the query string).
 * - Accept: application/json+canvas-string-ids so 64-bit ids stay exact in JS.
 * - Link-header pagination, capped, and only followed on the configured origin.
 * - Redirects are refused for API calls so the token cannot be forwarded to another host.
 * - File downloads follow Canvas's redirect to its file host by hand: every hop is checked
 *   by the SSRF guard and the token is sent to the Canvas origin only.
 */
import { allowLocalNetworksEnabled, validateUrlForSSRF } from '@/lib/server/ssrf-guard';

import type { CanvasConfig } from './config';
import { parseNextLink } from './link-header';

const REQUEST_TIMEOUT_MS = 15_000;
const DOWNLOAD_TIMEOUT_MS = 60_000;
const MAX_REDIRECTS = 4;

export class CanvasApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'CanvasApiError';
  }
}

type Query = Record<string, string | string[] | number | boolean | undefined>;

function buildUrl(config: CanvasConfig, path: string, query: Query = {}): string {
  const url = new URL(`${config.baseUrl}/api/v1${path}`);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(key, item);
    } else {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function assertSafeTarget(url: string): Promise<URL> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' && !allowLocalNetworksEnabled()) {
    throw new CanvasApiError('Canvas URLs must use https', 403);
  }
  const blocked = await validateUrlForSSRF(url);
  if (blocked) throw new CanvasApiError(blocked, 403);
  return parsed;
}

async function canvasRequest(config: CanvasConfig, url: string): Promise<Response> {
  const parsed = new URL(url);
  if (parsed.origin !== config.baseUrl) {
    throw new CanvasApiError('Refusing to call a different origin than the Canvas base URL', 403);
  }
  await assertSafeTarget(url);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: 'application/json+canvas-string-ids',
      },
      redirect: 'error',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new CanvasApiError('Could not reach Canvas', 502);
  }
  if (!response.ok) {
    throw new CanvasApiError(`Canvas responded with HTTP ${response.status}`, response.status);
  }
  return response;
}

/** One JSON resource (no pagination). */
export async function canvasGet<T>(config: CanvasConfig, path: string, query?: Query): Promise<T> {
  const response = await canvasRequest(config, buildUrl(config, path, query));
  return (await response.json()) as T;
}

/** A paginated collection, following rel=next up to maxPages. */
export async function canvasList<T>(
  config: CanvasConfig,
  path: string,
  query: Query = {},
  maxPages = 5,
): Promise<T[]> {
  const items: T[] = [];
  let next: string | null = buildUrl(config, path, { per_page: 50, ...query });
  for (let page = 0; next && page < maxPages; page += 1) {
    const response = await canvasRequest(config, next);
    const body = (await response.json()) as T[];
    if (Array.isArray(body)) items.push(...body);
    next = parseNextLink(response.headers.get('link'));
  }
  return items;
}

export interface CanvasFileMeta {
  id: string;
  display_name?: string;
  filename?: string;
  'content-type'?: string;
  size?: number;
  url?: string;
  locked_for_user?: boolean;
  hidden?: boolean;
  updated_at?: string;
}

async function readCapped(response: Response, maxBytes: number): Promise<Buffer> {
  const reader = response.body?.getReader();
  if (!reader) throw new CanvasApiError('Canvas returned an empty file body', 502);
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new CanvasApiError('File is larger than the import limit', 413);
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

export interface CanvasDownload {
  bytes: Buffer;
  name: string;
  contentType: string;
}

/** Download one Canvas file (by id) into memory, capped at maxBytes. */
export async function canvasDownload(
  config: CanvasConfig,
  fileId: string,
  maxBytes: number,
): Promise<CanvasDownload> {
  const meta = await canvasGet<CanvasFileMeta>(config, `/files/${fileId}`);
  if (meta.locked_for_user) throw new CanvasApiError('This file is locked in Canvas', 403);
  if (!meta.url) throw new CanvasApiError('Canvas returned no download URL', 502);
  if (typeof meta.size === 'number' && meta.size > maxBytes) {
    throw new CanvasApiError('File is larger than the import limit', 413);
  }

  let url = meta.url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const parsed = await assertSafeTarget(url);
    const sameOrigin = parsed.origin === config.baseUrl;
    let response: Response;
    try {
      response = await fetch(url, {
        headers: sameOrigin ? { Authorization: `Bearer ${config.token}` } : {},
        redirect: 'manual',
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      });
    } catch {
      throw new CanvasApiError('Could not download the file from Canvas', 502);
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new CanvasApiError('Canvas redirect had no target', 502);
      url = new URL(location, url).toString();
      continue;
    }
    if (!response.ok) {
      throw new CanvasApiError(`Canvas responded with HTTP ${response.status}`, response.status);
    }
    const bytes = await readCapped(response, maxBytes);
    return {
      bytes,
      name: meta.display_name || meta.filename || `canvas-file-${fileId}`,
      contentType:
        meta['content-type'] ||
        response.headers.get('content-type')?.split(';', 1)[0] ||
        'application/octet-stream',
    };
  }
  throw new CanvasApiError('Too many redirects while downloading the file', 502);
}

/** HTTP status and message to relay for a Canvas failure (never includes the token). */
export function describeCanvasError(error: unknown): { status: number; message: string } {
  if (error instanceof CanvasApiError) {
    if (error.status === 401) {
      return {
        status: 502,
        message: 'Canvas가 액세스 토큰을 거부했습니다. 토큰이 올바르지 않거나 만료되었습니다. 다시 발급해 저장해 주세요.',
      };
    }
    if (error.status === 403) return { status: 403, message: error.message };
    if (error.status === 404) {
      return { status: 404, message: 'Canvas에서 찾을 수 없는 항목입니다.' };
    }
    if (error.status === 413) return { status: 413, message: error.message };
    if (error.status === 429) {
      return { status: 429, message: 'Canvas 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' };
    }
    return { status: 502, message: error.message };
  }
  return { status: 500, message: 'Canvas request failed' };
}
