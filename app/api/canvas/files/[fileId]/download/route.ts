/**
 * GET /api/canvas/files/:fileId/download
 *
 * Streams one Canvas file through the server (the token never reaches the browser). The browser
 * then uploads it to /api/materials, which applies the normal MIME policy and quotas.
 */
import type { NextRequest } from 'next/server';

import { canvasDownload, describeCanvasError } from '@/lib/canvas/client';
import { resolveCanvasConfig } from '@/lib/canvas/config';
import { MAX_CANVAS_FILE_BYTES } from '@/lib/canvas/files';
import { apiError } from '@/lib/server/api-response';
import { withRequestOwner } from '@/lib/server/identity/with-owner';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await context.params;
  return withRequestOwner(req, async (_owner, responseHeaders) => {
    const withHeaders = (res: Response) => {
      for (const [key, value] of responseHeaders) res.headers.append(key, value);
      return res;
    };
    const config = resolveCanvasConfig(req);
    if (!config) return new Response('Not found', { status: 404, headers: responseHeaders });
    if (!/^\d{1,20}$/.test(fileId)) {
      return withHeaders(apiError('INVALID_REQUEST', 400, 'fileId must be numeric'));
    }
    try {
      const file = await canvasDownload(config, fileId, MAX_CANVAS_FILE_BYTES);
      const res = new Response(new Blob([file.bytes as unknown as BlobPart]), {
        status: 200,
        headers: {
          'content-type': file.contentType,
          'x-material-filename': encodeURIComponent(file.name),
          'cache-control': 'private, no-store',
        },
      });
      return withHeaders(res);
    } catch (error) {
      const { status, message } = describeCanvasError(error);
      return withHeaders(apiError('UPSTREAM_ERROR', status, message));
    }
  });
}
