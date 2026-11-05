/**
 * Minimal Canvas LMS REST client (https://developerdocs.instructure.com/services/canvas).
 *
 * - Bearer auth in the Authorization header (never the query string).
 * - `Accept: application/json+canvas-string-ids` so 64-bit ids stay exact in JS.
 * - Link-header pagination, capped, and only followed on the configured origin.
 * - Redirects are refused so the token cannot be forwarded to another host.
 * - Target is checked by the existing SSRF guard.
 */
import { allowLocalNetworksEnabled, validateUrlForSSRF } from '@/lib/server/ssrf-guard';

import type { CanvasConfig } from './config';
import { parseNextLink } from './link-header';

const REQUEST_TIMEOUT_MS = 15_000;

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

async function canvasRequest(config: CanvasConfig, url: string): Promise<Response> {
  const parsed = new URL(url);
  if (parsed.origin !== config.baseUrl) {
    throw new CanvasApiError('Refusing to call a different origin than CANVAS_BASE_URL', 403);
  }
  if (parsed.protocol !== 'https:' && !allowLocalNetworksEnabled()) {
    throw new CanvasApiError('CANVAS_BASE_URL must use https', 403);
  }
  const blocked = await validateUrlForSSRF(url);
  if (blocked) throw new CanvasApiError(blocked, 403);

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

/** A paginated collection, following `rel=next` up to `maxPages`. */
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

/** HTTP status and message to relay for a Canvas failure (never includes the token). */
export function describeCanvasError(error: unknown): { status: number; message: string } {
  if (error instanceof CanvasApiError) {
    if (error.status === 401) {
      return { status: 502, message: 'Canvas rejected the access token. Check CANVAS_ACCESS_TOKEN.' };
    }
    if (error.status === 403) return { status: 403, message: error.message };
    if (error.status === 404) return { status: 404, message: 'Canvas resource not found' };
    if (error.status === 429) return { status: 429, message: 'Canvas rate limit reached. Try again shortly.' };
    return { status: 502, message: error.message };
  }
  return { status: 500, message: 'Canvas request failed' };
}
