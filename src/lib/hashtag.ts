import type { Tag } from './api/types';

/**
 * A name as the server compares hashtags: in lower case and without accents, so `pyöräily` is `pyoraily` (the server
 * keeps the name of a hashtag without them, but the text of a post has what the author wrote)
 */
const fold = (name: string) => name.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * The hashtag with the name written in a link (`#Name` or `Name`), or undefined. Only the hashtags the server lists for
 * the post count (`Status.tags`), so a link that merely looks like one is left alone. The name decides, not the address:
 * a post from another server keeps that server's own address for the hashtag, and the case and the accents of the
 * name differ.
 */
export function tagNamed(tags: Tag[] | undefined, text: string): Tag | undefined {
  const name = fold(text.trim().replace(/^#/, ''));
  return name ? tags?.find((tag) => fold(tag.name) === name) : undefined;
}

/** Everything in a paragraph, piece by piece: a link (with what is in it), a line break, another tag, white space, a word */
const PIECE = /<a\b[^>]*>(?:[^<]|<\/?span[^>]*>)*<\/a>|<br\s*\/?>|<[^>]*>|\s+|[^<\s]+/g;
const LINK = /^<a\b([^>]*)>((?:[^<]|<\/?span[^>]*>)*)<\/a>$/;

/** A hashtag in the bar under a post: `label` is its name as the author wrote it (the `name` is the server's, without accents) */
export interface BarTag extends Tag {
  label: string;
}

/** The hashtag a piece of HTML is a link to (a link with the class `hashtag`), if it is one of the hashtags of the post */
function hashtagOf(piece: string, tags: Tag[]): BarTag | undefined {
  const link = LINK.exec(piece);
  if (!link || !/\bclass="[^"]*\bhashtag\b/.test(link[1])) return undefined;
  const written = link[2].replace(/<[^>]*>/g, '').trim().replace(/^#/, '');
  const tag = tagNamed(tags, written);
  return tag && { ...tag, label: written };
}

/** The hashtags the hashtag links in HTML stand for */
function linkedTags(html: string, tags: Tag[]): Set<string> {
  const names = new Set<string>();
  for (const [piece] of html.matchAll(PIECE)) {
    const tag = hashtagOf(piece, tags);
    if (tag) names.add(fold(tag.name));
  }
  return names;
}

/**
 * The hashtag bar, like on Mastodon's own web interface: hashtags that end the post are taken out of the text and shown
 * as a row of links under it, together with the hashtags of the post that the text does not link at all. What ends the
 * post is the last paragraph's trailing run of hashtag links (with white space and line breaks between), whether
 * the paragraph is only that or has other text before it, and also when a link follows them (it stays in the text). A single hashtag after other text stays (it may be part of
 * the sentence), and so does a post that is only hashtags. Hashtags in the middle of the text stay too. The text is cut
 * by its string form and sanitized afterwards, as before.
 */
export function splitTrailingTags(html: string, tags: Tag[] | undefined): { html: string; bar: BarTag[] } {
  if (!tags?.length) return { html, bar: [] };
  const bar = new Map<string, BarTag>();
  const trimmed = html.trimEnd();
  const start = trimmed.lastIndexOf('<p>');
  const inner = start >= 0 && trimmed.endsWith('</p>') ? trimmed.slice(start + 3, -4) : null;
  let text = html;
  let moved: BarTag[] = [];

  if (inner !== null && !inner.includes('</p>')) {
    const pieces = [...inner.matchAll(PIECE)];
    // A link (not a mention or a hashtag) that ends the paragraph stays where it is, after the hashtags
    let end = pieces.length;
    while (end > 0 && /^\s+$|^<br\s*\/?>$/.test(pieces[end - 1][0])) end--;
    const last = end > 0 ? LINK.exec(pieces[end - 1][0]) : null;
    const tailAt = last && !/\bclass="[^"]*\b(?:hashtag|mention)\b/.test(last[1]) ? end - 1 : pieces.length;
    const tail = inner.slice(pieces[tailAt]?.index ?? inner.length).trim();

    let first = tailAt;
    const run: BarTag[] = [];
    for (let i = tailAt - 1; i >= 0; i--) {
      const piece = pieces[i][0];
      const tag = hashtagOf(piece, tags);
      if (tag) run.unshift(tag);
      else if (!/^\s+$|^<br\s*\/?>$/.test(piece)) break;
      first = i;
    }
    const rest = inner.slice(0, pieces[first]?.index ?? inner.length).trim();
    // Not the one paragraph of a post that is only hashtags, and not a lone hashtag that may end a sentence
    const movable = rest !== '' || tail !== '' ? rest === '' || run.length > 1 : start > 0;
    if (run.length > 0 && movable) {
      const kept = rest && tail ? `${rest}<br />${tail}` : rest || tail;
      text = trimmed.slice(0, start) + (kept ? `<p>${kept}</p>` : '');
      moved = run;
    }
  }

  const linked = linkedTags(text, tags);
  for (const tag of [...moved, ...tags.map((tag) => ({ ...tag, label: tag.name }))]) if (!linked.has(fold(tag.name)) && !bar.has(fold(tag.name))) bar.set(fold(tag.name), tag);
  return { html: text, bar: [...bar.values()] };
}
