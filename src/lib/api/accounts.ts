import type { MastodonClient } from './client';
import type { AccountFull, Relationship } from './types';

export const getAccount = (client: MastodonClient, id: string) => client.get<AccountFull>(`/api/v1/accounts/${id}`);

/** Finds an account by its handle ("user" for local accounts, "user@server" for remote ones). */
export const lookupAccount = (client: MastodonClient, acct: string) =>
  client.get<AccountFull>('/api/v1/accounts/lookup', { acct });

export async function getRelationship(client: MastodonClient, id: string): Promise<Relationship | null> {
  const list = await client.get<Relationship[]>(`/api/v1/accounts/relationships?id[]=${encodeURIComponent(id)}`);
  return list[0] ?? null;
}

export const followEndpoint = (id: string, on: boolean) => `/api/v1/accounts/${id}/${on ? 'follow' : 'unfollow'}`;
