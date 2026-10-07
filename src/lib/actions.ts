import type { MastodonClient } from './api/client';
import type { Status } from './api/types';

export type ActionKind = 'favourite' | 'reblog' | 'bookmark';

const FLAG = { favourite: 'favourited', reblog: 'reblogged', bookmark: 'bookmarked' } as const;
const COUNT = { favourite: 'favourites_count', reblog: 'reblogs_count', bookmark: null } as const;

export function isOn(s: Status, kind: ActionKind): boolean {
  return !!s[FLAG[kind]];
}

/** Boosting is not possible for private (followers-only / direct) posts. */
export function canReblog(s: Status): boolean {
  return s.visibility === 'public' || s.visibility === 'unlisted';
}

/** The server counts or governs quotes (Mastodon 4.5+); on older ones there is no quote action */
export function quoteSupported(s: Status): boolean {
  return s.quotes_count !== undefined || !!s.quote_approval;
}

/** Only public and unlisted posts can be quoted, and not when the author has denied it to this account. */
export function canQuote(s: Status): boolean {
  return quoteSupported(s) && canReblog(s) && s.quote_approval?.current_user !== 'denied';
}

export function endpoint(id: string, kind: ActionKind, on: boolean): string {
  return `/api/v1/statuses/${id}/${on ? kind : `un${kind}`}`;
}

/** Sets the flag and counter locally (optimistic update / rollback). */
export function applyState(s: Status, kind: ActionKind, on: boolean): void {
  const wasOn = isOn(s, kind);
  s[FLAG[kind]] = on;
  const countKey = COUNT[kind];
  if (countKey && wasOn !== on) s[countKey] = Math.max(0, s[countKey] + (on ? 1 : -1));
}

/**
 * Toggles the state immediately and calls the API. On failure the previous state is restored and the
 * error is rethrown. `s` is always the original post (`status.reblog` for a boost), not the boost wrapper.
 */
export async function toggle(client: MastodonClient, s: Status, kind: ActionKind): Promise<void> {
  const on = !isOn(s, kind);
  applyState(s, kind, on);
  try {
    await client.post(endpoint(s.id, kind, on));
  } catch (e) {
    applyState(s, kind, !on);
    throw e;
  }
}
