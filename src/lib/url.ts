/**
 * The one check for every address that comes from a server and ends up in a link or a media element
 * (a post's own page, an attachment, a profile). Only http and https are let through: a `javascript:`, `data:`,
 * `file:` or app-specific address from a misbehaving server must never become a link the reader can click.
 * Returns the normalized address, or null when there is nothing safe to link to.
 *
 * Addresses of files the reader picked on their own device (`blob:` previews in the post form) are made by the
 * app itself and do not come through here.
 */
export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  // The URL parser silently drops tabs and line breaks, which would let "java\tscript:" look harmless to a naive check
  if (!text || /[\u0000-\u001f\u007f]/.test(text)) return null;
  try {
    const url = new URL(text);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}
