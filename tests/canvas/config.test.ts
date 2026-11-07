import { describe, expect, it } from 'vitest';

import {
  buildSetCookie,
  DEFAULT_CANVAS_BASE_URL,
  isAllowedCanvasHost,
  isPlausibleCanvasToken,
  normalizeCanvasBaseUrl,
  resolveCanvasCredentials,
} from '../../lib/canvas/config';

describe('canvas config', () => {
  it('normalizes a bare host to an https origin', () => {
    expect(normalizeCanvasBaseUrl('lms.korea.ac.kr')).toBe('https://lms.korea.ac.kr');
    expect(normalizeCanvasBaseUrl('https://lms.korea.ac.kr/courses/1?x=1')).toBe(
      'https://lms.korea.ac.kr',
    );
    expect(normalizeCanvasBaseUrl('   ')).toBeNull();
  });

  it('allows the Korea University hosts and instructure.com only', () => {
    expect(isAllowedCanvasHost('lms.korea.ac.kr', {})).toBe(true);
    expect(isAllowedCanvasHost('mylms.korea.ac.kr', {})).toBe(true);
    expect(isAllowedCanvasHost('school.instructure.com', {})).toBe(true);
    expect(isAllowedCanvasHost('evil.example.com', {})).toBe(false);
    expect(isAllowedCanvasHost('lms.korea.ac.kr.evil.com', {})).toBe(false);
    expect(isAllowedCanvasHost('x.edu', { CANVAS_ALLOWED_HOSTS: 'x.edu' })).toBe(true);
  });

  it('rejects implausible tokens', () => {
    expect(isPlausibleCanvasToken('abc')).toBe(false);
    expect(isPlausibleCanvasToken('has space in it 12345')).toBe(false);
    expect(isPlausibleCanvasToken('1234~abcdEFGHijkl')).toBe(true);
  });

  it('prefers saved credentials and refuses a saved token for a foreign host', () => {
    const saved = resolveCanvasCredentials({}, { baseUrl: 'https://lms.korea.ac.kr', token: 'tok-12345678' });
    expect(saved?.source).toBe('saved');
    expect(saved?.config.baseUrl).toBe('https://lms.korea.ac.kr');
    expect(
      resolveCanvasCredentials({}, { baseUrl: 'https://evil.example.com', token: 'tok-12345678' }),
    ).toBeNull();
    expect(
      resolveCanvasCredentials({}, { baseUrl: 'http://lms.korea.ac.kr', token: 'tok-12345678' }),
    ).toBeNull();
  });

  it('falls back to the server environment and the Korea University default', () => {
    expect(resolveCanvasCredentials({ CANVAS_ACCESS_TOKEN: 'envtoken12345' }, null)?.config.baseUrl).toBe(
      DEFAULT_CANVAS_BASE_URL,
    );
    expect(resolveCanvasCredentials({}, null)).toBeNull();
  });

  it('builds an HttpOnly cookie scoped to the canvas routes', () => {
    const cookie = buildSetCookie('a', 'b c', { secure: true, maxAge: 10 });
    expect(cookie).toContain('a=b%20c');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Path=/api/canvas');
    expect(cookie).toContain('Secure');
  });
});
