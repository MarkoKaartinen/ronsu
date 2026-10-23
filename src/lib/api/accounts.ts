import type { MastodonClient } from './client';
import { parseDefaultPrivacy } from '../composeLogic';
import type { Account, AccountCredentials, AccountFull, Relationship, Status, Visibility } from './types';

export const getAccount = (client: MastodonClient, id: string) => client.get<AccountFull>(`/api/v1/accounts/${id}`);

/** Finds an account by its handle ("user" for local accounts, "user@server" for remote ones). */
export const lookupAccount = (client: MastodonClient, acct: string) =>
  client.get<AccountFull>('/api/v1/accounts/lookup', { acct });

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
