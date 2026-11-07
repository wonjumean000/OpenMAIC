/** GET /api/canvas/courses/:courseId/files: the files of a course, for the import picker. */
import type { NextRequest } from 'next/server';

import { describeCanvasError } from '@/lib/canvas/client';
import { resolveCanvasConfig } from '@/lib/canvas/config';
import { listCourseFiles } from '@/lib/canvas/files';
import { apiError } from '@/lib/server/api-response';
import { ownerJson } from '@/lib/server/agent-runtime/route-response';
import { withRequestOwner } from '@/lib/server/identity/with-owner';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ courseId: string }> },
) {
  const { courseId } = await context.params;
  return withRequestOwner(req, async (_owner, responseHeaders) => {
    const fail = (res: Response) => {
      for (const [key, value] of responseHeaders) res.headers.append(key, value);
      return res;
    };
    const config = resolveCanvasConfig(req);
    if (!config) return new Response('Not found', { status: 404, headers: responseHeaders });
    if (!/^\d{1,20}$/.test(courseId)) {
      return fail(apiError('INVALID_REQUEST', 400, 'courseId must be numeric'));
    }
    try {
      return ownerJson({ files: await listCourseFiles(config, courseId) }, 200, responseHeaders);
    } catch (error) {
      const { status, message } = describeCanvasError(error);
      return fail(apiError('UPSTREAM_ERROR', status, message));
    }
  });
}
