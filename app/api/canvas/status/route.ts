/**
 * GET /api/canvas/status: is Canvas configured, and does the token work?
 * Never returns the token.
 */
import type { NextRequest } from 'next/server';

import { canvasGet, describeCanvasError } from '@/lib/canvas/client';
import { getCanvasConfig } from '@/lib/canvas/config';
import { apiError } from '@/lib/server/api-response';
import { ownerJson } from '@/lib/server/agent-runtime/route-response';
import { withRequestOwner } from '@/lib/server/identity/with-owner';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  return withRequestOwner(req, async (_owner, responseHeaders) => {
    const config = getCanvasConfig();
    if (!config) {
      return ownerJson({ configured: false }, 200, responseHeaders);
    }
    try {
      const me = await canvasGet<{ id: string; name?: string }>(config, '/users/self');
      return ownerJson(
        { configured: true, connected: true, host: new URL(config.baseUrl).host, userName: me.name ?? null },
        200,
        responseHeaders,
      );
    } catch (error) {
      const { status, message } = describeCanvasError(error);
      const res = apiError('UPSTREAM_ERROR', status, message);
      for (const [key, value] of responseHeaders) res.headers.append(key, value);
      return res;
    }
  });
}
