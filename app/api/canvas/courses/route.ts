/** GET /api/canvas/courses: the active courses of the connected Canvas account. */
import type { NextRequest } from 'next/server';

import { describeCanvasError } from '@/lib/canvas/client';
import { resolveCanvasConfig } from '@/lib/canvas/config';
import { listCourses } from '@/lib/canvas/content';
import { apiError } from '@/lib/server/api-response';
import { ownerJson } from '@/lib/server/agent-runtime/route-response';
import { withRequestOwner } from '@/lib/server/identity/with-owner';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  return withRequestOwner(req, async (_owner, responseHeaders) => {
    const config = resolveCanvasConfig(req);
    if (!config) return new Response('Not found', { status: 404, headers: responseHeaders });
    try {
      return ownerJson({ courses: await listCourses(config) }, 200, responseHeaders);
    } catch (error) {
      const { status, message } = describeCanvasError(error);
      const res = apiError('UPSTREAM_ERROR', status, message);
      for (const [key, value] of responseHeaders) res.headers.append(key, value);
      return res;
    }
  });
}
