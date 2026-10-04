import type { MastodonClient } from './api/client';
import { followEndpoint } from './api/accounts';
import type { AccountFull, Relationship } from './api/types';

/** Following, or a follow request pending (in both cases the button undoes it). */
export const isFollowing = (rel: Relationship) => rel.following || rel.requested;

/** Optimistic local update. Following a locked account only sends a request. */
export function applyFollow(rel: Relationship, account: AccountFull, on: boolean): void {
  if (on) {
    if (account.locked) {
      rel.requested = true;
    } else {
      rel.following = true;
      account.followers_count += 1;
    }
  } else {
    if (rel.following) account.followers_count = Math.max(0, account.followers_count - 1);
    rel.following = false;
    rel.requested = false;
  }
}

/**
 * Toggles following immediately and calls the API. On success the server's relationship replaces the
 * guess; on failure the previous state is restored and the error is rethrown.
 */
export async function toggleFollow(client: MastodonClient, account: AccountFull, rel: Relationship): Promise<void> {
  const on = !isFollowing(rel);
  const before = { ...rel };
  const followers = account.followers_count;
  applyFollow(rel, account, on);
  try {
    Object.assign(rel, await client.post<Relationship>(followEndpoint(account.id, on)));
  } catch (e) {
    Object.assign(rel, before);
    account.followers_count = followers;
    throw e;
  }
}
