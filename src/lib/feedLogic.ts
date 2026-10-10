import { compareIds } from './api/markers';

export type Order = 'oldest-first' | 'newest-first';

export const PAGE_SIZE = 40;

export type Params = Record<string, string | number>;

interface HasId {
  id: string;
}

/**
 * Mastodon always returns newest first, also for `min_id` queries (the page is the set of posts just
 * newer than the given id). Sort the page into reading order.
 */
export function normalizePage<T extends HasId>(order: Order, page: T[]): T[] {
  const sorted = [...page].sort((a, b) => compareIds(a.id, b.id));
  return order === 'oldest-first' ? sorted : sorted.reverse();
}

/**
 * Query parameters for the next page.
 * - oldest first: continue forwards from the last shown post (or the reading position) with `min_id`
 * - newest first: continue backwards from the last shown post with `max_id`
 * The first fetch in oldest-first mode without a reading position gets the newest posts (no parameters).
 */
export function pageParams<T extends HasId>(order: Order, items: T[], marker: string | null): Params {
  const base: Params = { limit: PAGE_SIZE };
  const last = items[items.length - 1];
  if (order === 'oldest-first') {
    const cursor = last?.id ?? marker;
    return cursor ? { ...base, min_id: cursor } : base;
  }
  return last ? { ...base, max_id: last.id } : base;
}

export interface ItemRect {
  id: string;
  bottom: number;
}

/**
 * The topmost post on screen = "this is where I am". `rects` are in DOM order. At least `minVisible`
 * px of a post must be visible, so a sliver at the top edge does not count. This post is saved as the
 * reading position, so returning opens the feed at exactly the same post.
 */
export function pickTopId(rects: ItemRect[], topEdge: number, minVisible = 48): string | null {
  for (const r of rects) {
    if (r.bottom - topEdge >= minVisible) return r.id;
  }
  return null;
}

export interface ItemBox extends ItemRect {
  top: number;
}

/**
 * The lowest post that is (partly) on screen: the newest one the reader has seen. `rects` are in DOM order. At
 * least `minVisible` px of a post must be above the bottom edge, so a sliver at the bottom does not count. The
 * reading position is the topmost post, but the posts below it that are on screen at the same time have been
 * seen too, which is why "how far behind" is measured from this one (at the very end it is the last post).
 */
export function pickLastVisibleId(rects: ItemBox[], topEdge: number, bottomEdge: number, minVisible = 40): string | null {
  let last: string | null = null;
  for (const r of rects) {
    if (r.bottom > topEdge && r.top < bottomEdge - minVisible) last = r.id;
  }
  return last;
}

/**
 * Newest-first mode: how far the reading position can move forwards. `items` are newest first, `seen` the ids that
 * have been on screen. The position moves to the newest post of the unbroken run of seen posts that starts right
 * above the current position, so it makes no difference whether the reader goes up from the divider or has
 * scrolled down from the top to reach it: a post that was never on screen is never marked as read. Null when
 * there is nothing to advance to (the position is not among the loaded posts, or the next post is unseen).
 */
export function advanceMarker<T extends HasId>(items: T[], marker: string, seen: ReadonlySet<string>): string | null {
  const at = items.findIndex((s) => compareIds(s.id, marker) <= 0);
  if (at <= 0) return null;
  let j = at - 1;
  while (j >= 0 && seen.has(items[j].id)) j--;
  return j === at - 1 ? null : items[j + 1].id;
}

/**
 * Newest-first mode: the posts a quick scroll upwards flew past between two looks at the screen. When the posts on
 * screen now are all newer than the ones on screen the previous time, the posts in between were scrolled past, and
 * count as seen so they do not hold the reading position back. A gap longer than `maxGap` is a jump (to the top, to
 * the divider), not reading, so nothing is counted then.
 */
export function skippedBetween<T extends HasId>(items: T[], previous: string[], now: string[], maxGap = 15): string[] {
  if (!previous.length || !now.length) return [];
  const prevNewest = previous.reduce((a, b) => (compareIds(a, b) >= 0 ? a : b));
  const nowOldest = now.reduce((a, b) => (compareIds(a, b) <= 0 ? a : b));
  if (compareIds(nowOldest, prevNewest) <= 0) return [];
  const gap = items.filter((i) => compareIds(i.id, prevNewest) > 0 && compareIds(i.id, nowOldest) < 0);
  return gap.length > maxGap ? [] : gap.map((i) => i.id);
}
