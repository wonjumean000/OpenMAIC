/**
 * GET /api/canvas/courses/:courseId/content?sections=syllabus,pages,assignments,modules
 *
 * Returns the course material as Markdown, ready to be used as the source text
 * of a generated classroom. Sections default to all of them.
 */
import type { NextRequest } from 'next/server';

import { describeCanvasError } from '@/lib/canvas/client';
import { getCanvasConfig } from '@/lib/canvas/config';
import { buildCourseContent, CANVAS_SECTIONS, type CanvasSection } from '@/lib/canvas/content';
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
    const config = getCanvasConfig();
    if (!config) return new Response('Not found', { status: 404, headers: responseHeaders });
    if (!/^\d{1,20}$/.test(courseId)) {
      return fail(apiError('INVALID_REQUEST', 400, 'courseId must be numeric'));
    }

    const raw = new URL(req.url).searchParams.get('sections');
    let sections: CanvasSection[] = [...CANVAS_SECTIONS];
    if (raw) {
      const requested = raw.split(',').map((s) => s.trim());
      const invalid = requested.filter((s) => !(CANVAS_SECTIONS as readonly string[]).includes(s));
      if (invalid.length > 0) {
        return fail(apiError('INVALID_REQUEST', 400, `unknown sections: ${invalid.join(', ')}`));
      }
      sections = requested as CanvasSection[];
    }

    try {
      return ownerJson(await buildCourseContent(config, courseId, sections), 200, responseHeaders);
    } catch (error) {
      const { status, message } = describeCanvasError(error);
      return fail(apiError('UPSTREAM_ERROR', status, message));
    }
  });
}
