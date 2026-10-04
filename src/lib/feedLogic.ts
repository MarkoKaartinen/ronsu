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
