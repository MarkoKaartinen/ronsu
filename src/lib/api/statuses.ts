import type { MastodonClient } from './client';
import type { Context, CustomEmoji, Status, Visibility } from './types';

export const getStatus = (client: MastodonClient, id: string) => client.get<Status>(`/api/v1/statuses/${id}`);

export const getContext = (client: MastodonClient, id: string) =>
  client.get<Context>(`/api/v1/statuses/${id}/context`);

export interface NewStatus {
  status: string;
  visibility: Visibility;
  in_reply_to_id?: string;
  /** Makes the post a quote post (Mastodon 4.5+) */
  quoted_status_id?: string;
  spoiler_text?: string;
  language?: string;
  media_ids?: string[];
  /** A poll: the options, how long it is open (seconds) and whether it takes several choices */
  poll?: { options: string[]; expires_in: number; multiple: boolean };
}

/**
 * Posts a status. Idempotency-Key: reusing the key on a retry does not create a duplicate, even if
 * the first request got through and only the response was lost.
 */
export const postStatus = (client: MastodonClient, body: NewStatus, idempotencyKey: string) =>
  client.post<Status>('/api/v1/statuses', body, { 'Idempotency-Key': idempotencyKey });

/** What the server allows a poll to be (`configuration.polls` of the instance information) */
export interface PollLimits {
  maxOptions: number;
  /** Characters in one option */
  maxChars: number;
  /** The shortest and the longest time a poll may stay open, in seconds */
  minExpiration: number;
  maxExpiration: number;
}

export interface InstanceLimits {
  maxChars: number;
  maxMedia: number;
  /** Characters allowed in an alt text */
  altChars: number;
  poll: PollLimits;
}

/** Mastodon's own limits for a poll (its PollOptionsValidator and PollExpirationValidator), for a server that does not tell them */
export const DEFAULT_POLL_LIMITS: PollLimits = { maxOptions: 4, maxChars: 50, minExpiration: 300, maxExpiration: 2_629_746 };

const DEFAULT_LIMITS: InstanceLimits = { maxChars: 500, maxMedia: 4, altChars: 1500, poll: DEFAULT_POLL_LIMITS };
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
        polls?: { max_options?: number; max_characters_per_option?: number; min_expiration?: number; max_expiration?: number };
      };
    }>('/api/v2/instance');
    const c = info.configuration;
    const limits = {
      maxChars: c?.statuses?.max_characters ?? DEFAULT_LIMITS.maxChars,
      maxMedia: c?.statuses?.max_media_attachments ?? DEFAULT_LIMITS.maxMedia,
      altChars: c?.media_attachments?.description_limit ?? DEFAULT_LIMITS.altChars,
      poll: {
        maxOptions: c?.polls?.max_options ?? DEFAULT_POLL_LIMITS.maxOptions,
        maxChars: c?.polls?.max_characters_per_option ?? DEFAULT_POLL_LIMITS.maxChars,
        minExpiration: c?.polls?.min_expiration ?? DEFAULT_POLL_LIMITS.minExpiration,
        maxExpiration: c?.polls?.max_expiration ?? DEFAULT_POLL_LIMITS.maxExpiration,
      },
    };
    limitsCache.set(client.base, limits);
    return limits;
  } catch {
    return DEFAULT_LIMITS;
  }
}

/** The custom emoji of the server (no scope needed) */
export const getCustomEmojis = (client: MastodonClient) => client.get<CustomEmoji[]>('/api/v1/custom_emojis');
