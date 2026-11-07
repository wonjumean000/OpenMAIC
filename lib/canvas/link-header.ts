/**
 * Canvas paginates with an RFC 5988 `Link` header.
 * Returns the `rel="next"` URL, or null when there is no further page.
 */
export function parseNextLink(header: string | null | undefined): string | null {
  if (!header) return null;
  for (const part of header.split(',')) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="?next"?/i);
    if (match) return match[1];
  }
  return null;
}
