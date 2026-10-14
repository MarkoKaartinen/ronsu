import type { MastodonClient } from './client';
import { ApiError } from './client';
import type { PushPolicy, PushType } from '../pushLogic';

/** A push subscription as the server reports it (`GET /api/v1/push/subscription`); there is one per access token */
export interface ServerPushSubscription {
  id: number | string;
  endpoint: string;
  alerts: Partial<Record<string, boolean>>;
  server_key?: string;
}

/** What the browser's subscription gives the server: where to send, and the keys to encrypt with */
export interface BrowserPushKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * The server's VAPID key, which a browser subscription must be made with. It is in the instance information from
 * Mastodon 4.3; a server without it cannot send web push to a browser.
 */
export async function getVapidKey(client: MastodonClient): Promise<string | null> {
  const info = await client.get<{ configuration?: { vapid?: { public_key?: string } } }>('/api/v2/instance');
  return info.configuration?.vapid?.public_key || null;
}

/** The subscription of this login, or null when there is none (404) */
export async function getPushSubscription(client: MastodonClient): Promise<ServerPushSubscription | null> {
  try {
    return await client.get<ServerPushSubscription>('/api/v1/push/subscription');
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/**
 * Replaces the subscription of this login. `standard` asks for the standardized encryption (RFC 8291, Mastodon 4.4):
 * browsers decrypt it themselves; older servers ignore it and send the old draft format.
 */
export function createPushSubscription(
  client: MastodonClient,
  keys: BrowserPushKeys,
  alerts: Record<PushType, boolean>,
  policy: PushPolicy,
): Promise<ServerPushSubscription> {
  return client.post<ServerPushSubscription>('/api/v1/push/subscription', {
    subscription: { endpoint: keys.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth }, standard: true },
    data: { alerts, policy },
  });
}

/** Changes which types are sent, and from whom, without a new subscription */
export function updatePushSubscription(
  client: MastodonClient,
  alerts: Record<PushType, boolean>,
  policy: PushPolicy,
): Promise<ServerPushSubscription> {
  return client.put<ServerPushSubscription>('/api/v1/push/subscription', { data: { alerts, policy } });
}

export async function deletePushSubscription(client: MastodonClient): Promise<void> {
  await client.delete('/api/v1/push/subscription');
}
