import type { Status } from './api/types';

/**
 * The choices for how long a mute lasts, in seconds (0 is until further notice): the same as in
 * Mastodon's web UI
 */
export const MUTE_DURATIONS = [0, 30 * 60, 60 * 60, 6 * 60 * 60, 24 * 60 * 60, 3 * 24 * 60 * 60, 7 * 24 * 60 * 60] as const;

/**
 * Whether a conversation can be muted: only one the user takes part in, as in Mastodon's web UI (the user wrote
 * the post, was mentioned in it or is answered by it)
 */
export function canMuteConversation(status: Status, selfId: string | undefined): boolean {
  if (!selfId) return false;
  return status.account.id === selfId || status.in_reply_to_account_id === selfId || !!status.mentions?.some((m) => m.id === selfId);
}

/** The server of a remote account (`user@server`), or null for an account of the user's own server */
export function remoteDomain(acct: string): string | null {
  const at = acct.indexOf('@');
  return at === -1 ? null : acct.slice(at + 1);
}
