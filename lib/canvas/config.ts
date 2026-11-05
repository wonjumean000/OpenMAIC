/**
 * Canvas LMS connection settings. Operator-configured (server environment), so
 * the access token never reaches the browser.
 *
 *   CANVAS_BASE_URL      e.g. https://myschool.instructure.com
 *   CANVAS_ACCESS_TOKEN  a personal access token or OAuth2 access token
 */
export interface CanvasConfig {
  baseUrl: string;
  token: string;
}

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
