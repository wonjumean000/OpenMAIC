import { describe, expect, it } from 'vitest';

import { getCanvasConfig } from '../../lib/canvas/config';
import { htmlToText } from '../../lib/canvas/html-to-text';
import { parseNextLink } from '../../lib/canvas/link-header';

describe('parseNextLink', () => {
  it('returns the next URL', () => {
    const header =
      '<https://x.instructure.com/api/v1/courses?page=2&per_page=50>; rel="next", <https://x.instructure.com/api/v1/courses?page=1>; rel="first"';
    expect(parseNextLink(header)).toBe('https://x.instructure.com/api/v1/courses?page=2&per_page=50');
  });
  it('returns null without a next link', () => {
    expect(parseNextLink('<https://x/y?page=1>; rel="first"')).toBeNull();
    expect(parseNextLink(null)).toBeNull();
  });
});

describe('htmlToText', () => {
  it('keeps structure and drops scripts and tags', () => {
    const text = htmlToText('<h2>Week 1</h2><script>alert(1)</script><ul><li>Read &amp; note</li></ul><p>Done</p>');
    expect(text).toContain('## Week 1');
    expect(text).toContain('- Read & note');
    expect(text).not.toContain('alert');
    expect(text).not.toContain('<');
  });
  it('handles empty input', () => {
    expect(htmlToText(null)).toBe('');
  });
});

describe('getCanvasConfig', () => {
  it('requires both values and keeps only the origin', () => {
    expect(getCanvasConfig({ CANVAS_BASE_URL: 'https://a.instructure.com/foo?x=1' } as NodeJS.ProcessEnv)).toBeNull();
    expect(
      getCanvasConfig({ CANVAS_BASE_URL: 'https://a.instructure.com/foo', CANVAS_ACCESS_TOKEN: 't' } as NodeJS.ProcessEnv),
    ).toEqual({ baseUrl: 'https://a.instructure.com', token: 't' });
  });
  it('rejects an unparseable URL', () => {
    expect(getCanvasConfig({ CANVAS_BASE_URL: 'nope', CANVAS_ACCESS_TOKEN: 't' } as NodeJS.ProcessEnv)).toBeNull();
  });
});
