import DOMPurify from 'dompurify';
import type { CustomEmoji } from './api/types';

const ALLOWED_TAGS = [
  'p', 'br', 'a', 'span', 'strong', 'b', 'em', 'i', 'u', 'del', 's',
  'pre', 'code', 'blockquote', 'ul', 'ol', 'li', 'img',
];
const ALLOWED_ATTR = ['href', 'class', 'rel', 'target', 'src', 'alt', 'title', 'translate'];

let hooked = false;
function ensureHook() {
  if (hooked) return;
  hooked = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer nofollow');
    }
    if (node.tagName === 'IMG') node.setAttribute('loading', 'lazy');
  });
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Replaces :shortcode: with custom emoji images. The input is already HTML. */
export function replaceEmojis(html: string, emojis: CustomEmoji[] | undefined): string {
  if (!emojis?.length) return html;
  const map = new Map(emojis.map((e) => [e.shortcode, e]));
  return html.replace(/:([a-zA-Z0-9_]+):/g, (whole, code: string) => {
    const e = map.get(code);
    if (!e) return whole;
    return `<img class="emoji" src="${escapeHtml(e.static_url)}" alt=":${code}:" title=":${code}:">`;
  });
}

/** Sanitizes server HTML (post content). */
export function sanitizeContent(html: string, emojis?: CustomEmoji[]): string {
  ensureHook();
  return DOMPurify.sanitize(replaceEmojis(html, emojis), { ALLOWED_TAGS, ALLOWED_ATTR });
}

/** Turns plain text (e.g. a display name) into safe HTML, custom emoji included. */
export function sanitizeText(text: string, emojis?: CustomEmoji[]): string {
  return sanitizeContent(replaceEmojis(escapeHtml(text), emojis));
}

/** Post HTML to plain text (e.g. the quote in the reply form). Does not touch the live DOM. */
export function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n'), 'text/html');
  return (doc.body.textContent ?? '').trim();
}
