import type { MastodonClient } from './client';
import { parseDefaultPrivacy } from '../composeLogic';
import type { Account, AccountCredentials, AccountFull, Relationship, Status, Visibility } from './types';

export const getAccount = (client: MastodonClient, id: string) => client.get<AccountFull>(`/api/v1/accounts/${id}`);

/** Finds an account by its handle ("user" for local accounts, "user@server" for remote ones). */
export const lookupAccount = (client: MastodonClient, acct: string) =>
  client.get<AccountFull>('/api/v1/accounts/lookup', { acct });

/** The parts of a profile: the posts (replies to others left out), the posts and replies, and the posts with media */
export type ProfileTab = 'posts' | 'replies' | 'media';

/** What each tab asks of `/accounts/:id/statuses`: `exclude_replies` leaves out only replies to other accounts, so a thread of the account's own stays */
const TAB_FILTERS: Record<ProfileTab, Record<string, string>> = {
  posts: { exclude_replies: 'true' },
  replies: {},
  media: { only_media: 'true' },
};

/** Mastodon's own default page size for the posts of an account (the maximum is 40) */
export const PROFILE_PAGE = 20;

/** A page of the posts of an account for a tab, newest first; pages go by post id (`max_id`) */
export const getAccountStatuses = (client: MastodonClient, id: string, tab: ProfileTab, maxId?: string) =>
  client.getPage<Status>(`/api/v1/accounts/${id}/statuses`, { limit: PROFILE_PAGE, ...TAB_FILTERS[tab], max_id: maxId });

/** The posts the account has pinned to its profile. The ordinary list has them too, in their place by time. */
export const getPinnedStatuses = (client: MastodonClient, id: string) =>
  client.get<Status[]>(`/api/v1/accounts/${id}/statuses`, { pinned: 'true' });

export async function getRelationship(client: MastodonClient, id: string): Promise<Relationship | null> {
  const list = await client.get<Relationship[]>(`/api/v1/accounts/relationships?id[]=${encodeURIComponent(id)}`);
  return list[0] ?? null;
}

export const followEndpoint = (id: string, on: boolean) => `/api/v1/accounts/${id}/${on ? 'follow' : 'unfollow'}`;

export type Moderation = 'mute' | 'unmute' | 'block' | 'unblock';

/** Muting and blocking (`write:mutes`, `write:blocks`); the response is the new relationship */
export const moderationEndpoint = (id: string, action: Moderation) => `/api/v1/accounts/${id}/${action}`;

/**
 * Mutes an account for `duration` seconds (0 is until further notice), with or without hiding its
 * notifications (`write:mutes`)
 */
export const muteAccount = (client: MastodonClient, id: string, duration: number, notifications: boolean) =>
  client.post<Relationship>(moderationEndpoint(id, 'mute'), { duration, notifications });

/** Blocks or unblocks a whole server (`write:blocks`) */
export const blockDomain = (client: MastodonClient, domain: string, on: boolean) =>
  on ? client.post<unknown>('/api/v1/domain_blocks', { domain }) : client.delete<unknown>(`/api/v1/domain_blocks?domain=${encodeURIComponent(domain)}`);

/** Mutes or unmutes a conversation, so it stops sending notifications (`write:mutes`); the response is the post */
export const muteConversation = (client: MastodonClient, id: string, on: boolean) =>
  client.post<Status>(`/api/v1/statuses/${id}/${on ? 'mute' : 'unmute'}`);

/** The account's own posting privacy (`source.privacy`), or null if the server does not say */
export async function getDefaultPrivacy(client: MastodonClient): Promise<Visibility | null> {
  const me = await client.get<AccountCredentials>('/api/v1/accounts/verify_credentials');
  return parseDefaultPrivacy(me.source?.privacy);
}

/** Number of handle suggestions shown while typing a mention */
export const MENTION_SUGGESTIONS = 5;

/** Accounts matching what is typed after an `@` (`read:accounts`) */
export const searchAccounts = (client: MastodonClient, q: string) =>
  client.get<Account[]>('/api/v1/accounts/search', { q, limit: MENTION_SUGGESTIONS });
