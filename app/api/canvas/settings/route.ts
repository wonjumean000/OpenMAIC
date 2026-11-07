/**
 * PUT    /api/canvas/settings  { baseUrl, token }  verify the token, then save it
 * DELETE /api/canvas/settings                      forget the saved token
 *
 * The token is stored in HttpOnly cookies scoped to /api/canvas, so page scripts can never read
 * it back. The host must be on the allowlist (lms.korea.ac.kr, mylms.korea.ac.kr, *.instructure.com,
 * CANVAS_ALLOWED_HOSTS, the operator's CANVAS_BASE_URL).
 */
import type { NextRequest } from 'next/server';

import { canvasGet, describeCanvasError } from '@/lib/canvas/client';
import {
  buildSetCookie,
  CANVAS_COOKIE_BASE,
  CANVAS_COOKIE_MAX_AGE,
  CANVAS_COOKIE_TOKEN,
  DEFAULT_CANVAS_BASE_URL,
  isAllowedCanvasHost,
  isPlausibleCanvasToken,
  normalizeCanvasBaseUrl,
} from '@/lib/canvas/config';
import { apiError } from '@/lib/server/api-response';
import { ownerJson } from '@/lib/server/agent-runtime/route-response';
import { withRequestOwner } from '@/lib/server/identity/with-owner';

export const runtime = 'nodejs';

function isSecureRequest(req: NextRequest): boolean {
  return req.nextUrl.protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
}

export async function PUT(req: NextRequest) {
  return withRequestOwner(req, async (_owner, responseHeaders) => {
    const fail = (res: Response) => {
      for (const [key, value] of responseHeaders) res.headers.append(key, value);
      return res;
    };
    if (!(req.headers.get('content-type') ?? '').includes('application/json')) {
      return fail(apiError('INVALID_REQUEST', 415, 'content-type must be application/json'));
    }
    const body = (await req.json().catch(() => null)) as {
      baseUrl?: unknown;
      token?: unknown;
    } | null;
    const rawBase = typeof body?.baseUrl === 'string' ? body.baseUrl : DEFAULT_CANVAS_BASE_URL;
    const token = typeof body?.token === 'string' ? body.token.trim() : '';

    const baseUrl = normalizeCanvasBaseUrl(rawBase);
    if (!baseUrl || !baseUrl.startsWith('https://')) {
      return fail(apiError('INVALID_REQUEST', 400, 'Canvas 주소는 https:// 로 시작해야 합니다.'));
    }
    if (!isAllowedCanvasHost(new URL(baseUrl).hostname)) {
      return fail(
        apiError(
          'INVALID_REQUEST',
          400,
          '허용되지 않은 Canvas 주소입니다. 관리자가 CANVAS_ALLOWED_HOSTS 에 추가해야 합니다.',
        ),
      );
    }
    if (!isPlausibleCanvasToken(token)) {
      return fail(apiError('INVALID_REQUEST', 400, '액세스 토큰 형식이 올바르지 않습니다.'));
    }

    try {
      const me = await canvasGet<{ id: string; name?: string }>({ baseUrl, token }, '/users/self');
      const res = ownerJson(
        {
          configured: true,
          connected: true,
          host: new URL(baseUrl).host,
          source: 'saved',
          userName: me.name ?? null,
        },
        200,
        responseHeaders,
      );
      const secure = isSecureRequest(req);
      res.headers.append(
        'set-cookie',
        buildSetCookie(CANVAS_COOKIE_BASE, baseUrl, { secure, maxAge: CANVAS_COOKIE_MAX_AGE }),
      );
      res.headers.append(
        'set-cookie',
        buildSetCookie(CANVAS_COOKIE_TOKEN, token, { secure, maxAge: CANVAS_COOKIE_MAX_AGE }),
      );
      return res;
    } catch (error) {
      const { status, message } = describeCanvasError(error);
      return fail(apiError('UPSTREAM_ERROR', status, message));
    }
  });
}

export async function DELETE(req: NextRequest) {
  return withRequestOwner(req, async (_owner, responseHeaders) => {
    const res = ownerJson({ configured: false }, 200, responseHeaders);
    const secure = isSecureRequest(req);
    res.headers.append('set-cookie', buildSetCookie(CANVAS_COOKIE_BASE, '', { secure, maxAge: 0 }));
    res.headers.append('set-cookie', buildSetCookie(CANVAS_COOKIE_TOKEN, '', { secure, maxAge: 0 }));
    return res;
  });
}
