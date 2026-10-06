import type { MastodonClient } from './client';
import type { Context, Status, Visibility } from './types';

export const getStatus = (client: MastodonClient, id: string) => client.get<Status>(`/api/v1/statuses/${id}`);

export const getContext = (client: MastodonClient, id: string) =>
  client.get<Context>(`/api/v1/statuses/${id}/context`);

export interface NewStatus {
  status: string;
  visibility: Visibility;
  in_reply_to_id?: string;
  spoiler_text?: string;
  language?: string;
  media_ids?: string[];
}

/**
 * Posts a status. Idempotency-Key: reusing the key on a retry does not create a duplicate, even if
 * the first request got through and only the response was lost.
 */
export const postStatus = (client: MastodonClient, body: NewStatus, idempotencyKey: string) =>
  client.post<Status>('/api/v1/statuses', body, { 'Idempotency-Key': idempotencyKey });

export interface InstanceLimits {
  maxChars: number;
  maxMedia: number;
  /** Characters allowed in an alt text */
  altChars: number;
}

const DEFAULT_LIMITS: InstanceLimits = { maxChars: 500, maxMedia: 4, altChars: 1500 };
const limitsCache = new Map<string, InstanceLimits>();

/** The server's limits (from the v2 instance info); Mastodon's defaults if they cannot be fetched. */
export async function getLimits(client: MastodonClient): Promise<InstanceLimits> {
  const cached = limitsCache.get(client.base);
  if (cached) return cached;
  try {
    const info = await client.get<{
      configuration?: {
        statuses?: { max_characters?: number; max_media_attachments?: number };
        media_attachments?: { description_limit?: number };
      };
    }>('/api/v2/instance');
    const c = info.configuration;
    const limits = {
      maxChars: c?.statuses?.max_characters ?? DEFAULT_LIMITS.maxChars,
      maxMedia: c?.statuses?.max_media_attachments ?? DEFAULT_LIMITS.maxMedia,
      altChars: c?.media_attachments?.description_limit ?? DEFAULT_LIMITS.altChars,
    };
    limitsCache.set(client.base, limits);
    return limits;
  } catch {
    return DEFAULT_LIMITS;
  }
}
