/**
 * Canvas LMS connection settings.
 *
 * Two sources, in this order:
 *   1. Credentials the user saved in Settings > Canvas LMS. They live in
 *      HttpOnly cookies (never readable by page scripts) and the host must be on
 *      the allowlist below, so a saved token can only ever be sent to a Canvas
 *      host the operator expects.
 *   2. Server environment (operator-configured):
 *        CANVAS_BASE_URL      e.g. https://lms.korea.ac.kr
 *        CANVAS_ACCESS_TOKEN  a personal access token or OAuth2 access token
 *        CANVAS_ALLOWED_HOSTS optional, comma separated extra hosts users may save
 */
import type { NextRequest } from 'next/server';

export interface CanvasConfig {
  baseUrl: string;
  token: string;
}

export type CanvasConfigSource = 'saved' | 'env';

export const DEFAULT_CANVAS_BASE_URL = 'https://lms.korea.ac.kr';
export const CANVAS_PRESET_HOSTS = ['lms.korea.ac.kr', 'mylms.korea.ac.kr'] as const;

export const CANVAS_COOKIE_TOKEN = 'openmaic_canvas_token';
export const CANVAS_COOKIE_BASE = 'openmaic_canvas_base';
export const CANVAS_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export function getCanvasConfig(env: NodeJS.ProcessEnv = process.env): CanvasConfig | null {
  const rawBase = env.CANVAS_BASE_URL?.trim();
  const token = env.CANVAS_ACCESS_TOKEN?.trim();
  if (!rawBase || !token) return null;
  let url: URL;
  try {
    url = new URL(rawBase);
  } catch {
    return null;
  }
  // Only the origin is used; any path, query or fragment in the setting is dropped.
  return { baseUrl: url.origin, token };
}

/** lms.korea.ac.kr or https://lms.korea.ac.kr/foo becomes https://lms.korea.ac.kr */
export function normalizeCanvasBaseUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    return new URL(withScheme).origin;
  } catch {
    return null;
  }
}

/** Hosts a user may save a token for. */
export function isAllowedCanvasHost(hostname: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const host = hostname.trim().toLowerCase();
  if (!host) return false;
  if ((CANVAS_PRESET_HOSTS as readonly string[]).includes(host)) return true;
  if (host.endsWith('.instructure.com')) return true;
  const extra = (env.CANVAS_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (extra.includes(host)) return true;
  const configured = normalizeCanvasBaseUrl(env.CANVAS_BASE_URL ?? '');
  if (configured) {
    try {
      if (new URL(configured).hostname.toLowerCase() === host) return true;
    } catch {
      // ignore
    }
  }
  return false;
}

/** Canvas tokens are printable ASCII without whitespace. */
export function isPlausibleCanvasToken(token: string): boolean {
  return /^[\x21-\x7e]{8,512}$/.test(token);
}

export interface SavedCanvasCredentials {
  baseUrl?: string;
  token?: string;
}

export function resolveCanvasCredentials(
  env: NodeJS.ProcessEnv,
  saved?: SavedCanvasCredentials | null,
): { config: CanvasConfig; source: CanvasConfigSource } | null {
  if (saved?.token && saved.baseUrl) {
    const base = normalizeCanvasBaseUrl(saved.baseUrl);
    if (!base || !base.startsWith('https://')) return null;
    if (!isAllowedCanvasHost(new URL(base).hostname, env)) return null;
    return { config: { baseUrl: base, token: saved.token }, source: 'saved' };
  }
  const fromEnv = getCanvasConfig(env);
  if (fromEnv) return { config: fromEnv, source: 'env' };
  const token = env.CANVAS_ACCESS_TOKEN?.trim();
  if (token) return { config: { baseUrl: DEFAULT_CANVAS_BASE_URL, token }, source: 'env' };
  return null;
}

export function resolveCanvasConfigWithSource(
  req: NextRequest,
): { config: CanvasConfig; source: CanvasConfigSource } | null {
  const token = req.cookies.get(CANVAS_COOKIE_TOKEN)?.value;
  const baseUrl = req.cookies.get(CANVAS_COOKIE_BASE)?.value;
  return resolveCanvasCredentials(process.env, { token, baseUrl });
}

export function resolveCanvasConfig(req: NextRequest): CanvasConfig | null {
  return resolveCanvasConfigWithSource(req)?.config ?? null;
}

export function buildSetCookie(
  name: string,
  value: string,
  options: { secure: boolean; maxAge: number },
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/api/canvas',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${options.maxAge}`,
  ];
  if (options.secure) parts.push('Secure');
  return parts.join('; ');
}
