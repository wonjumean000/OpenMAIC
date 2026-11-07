/**
 * GET /api/canvas/status: is Canvas configured, and does the token work?
 * Never returns the token.
 */
import type { NextRequest } from 'next/server';

import { canvasGet, describeCanvasError } from '@/lib/canvas/client';
import {
  CANVAS_PRESET_HOSTS,
  DEFAULT_CANVAS_BASE_URL,
  resolveCanvasConfigWithSource,
} from '@/lib/canvas/config';
import { ownerJson } from '@/lib/server/agent-runtime/route-response';
import { withRequestOwner } from '@/lib/server/identity/with-owner';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  return withRequestOwner(req, async (_owner, responseHeaders) => {
    const resolved = resolveCanvasConfigWithSource(req);
    if (!resolved) {
      return ownerJson(
        {
          configured: false,
          defaultBaseUrl: DEFAULT_CANVAS_BASE_URL,
          presetHosts: CANVAS_PRESET_HOSTS,
        },
        200,
        responseHeaders,
      );
    }
    const { config, source } = resolved;
    const host = new URL(config.baseUrl).host;
    try {
      const me = await canvasGet<{ id: string; name?: string }>(config, '/users/self');
      return ownerJson(
        { configured: true, connected: true, host, source, userName: me.name ?? null },
        200,
        responseHeaders,
      );
    } catch (error) {
      const { message } = describeCanvasError(error);
      return ownerJson(
        { configured: true, connected: false, host, source, error: message },
        200,
        responseHeaders,
      );
    }
  });
}
