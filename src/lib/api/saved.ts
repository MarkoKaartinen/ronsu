import type { MastodonClient } from './client';
import type { Status } from './types';

export type SavedKind = 'bookmarks' | 'favourites';

/** Mastodon's own default page size for these lists (the maximum is 40) */
export const SAVED_PAGE = 20;

/**
 * A page of the posts the reader has bookmarked or favourited, newest saved first. Paging goes by the server's own
 * counter for the list, not by post ids: the cursor comes from the Link header (`cursorOf` in client.ts).
 */
export const getSaved = (client: MastodonClient, kind: SavedKind, maxId?: string) =>
  client.getPage<Status>(`/api/v1/${kind}`, { limit: SAVED_PAGE, max_id: maxId });
