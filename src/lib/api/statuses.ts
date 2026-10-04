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
}

/**
 * Posts a status. Idempotency-Key: reusing the key on a retry does not create a duplicate, even if
 * the first request got through and only the response was lost.
 */
export const postStatus = (client: MastodonClient, body: NewStatus, idempotencyKey: string) =>
  client.post<Status>('/api/v1/statuses', body, { 'Idempotency-Key': idempotencyKey });

const maxCharsCache = new Map<string, number>();
const DEFAULT_MAX_CHARS = 500;

/** The server's character limit (from the v2 instance info); 500 if it cannot be fetched. */
export async function getMaxChars(client: MastodonClient): Promise<number> {
  const cached = maxCharsCache.get(client.base);
  if (cached) return cached;
  try {
    const info = await client.get<{ configuration?: { statuses?: { max_characters?: number } } }>('/api/v2/instance');
    const max = info.configuration?.statuses?.max_characters ?? DEFAULT_MAX_CHARS;
    maxCharsCache.set(client.base, max);
    return max;
  } catch {
    return DEFAULT_MAX_CHARS;
  }
}
