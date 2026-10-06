import type { MastodonClient } from './client';
import type { MediaAttachment } from './types';

/**
 * Uploads a file. The server answers 202 while it still processes the file; then `url` is empty and
 * waitForProcessing polls until it is ready.
 */
export function uploadMedia(client: MastodonClient, file: File, signal?: AbortSignal): Promise<MediaAttachment> {
  const form = new FormData();
  form.append('file', file);
  return client.post<MediaAttachment>('/api/v2/media', form, {}, { signal });
}

export const updateMedia = (client: MastodonClient, id: string, description: string) =>
  client.put<MediaAttachment>(`/api/v1/media/${id}`, { description });

/** Polls until the server has processed the file (a status cannot be posted with unprocessed media). */
export async function waitForProcessing(
  client: MastodonClient,
  media: MediaAttachment,
  { intervalMs = 1000, attempts = 60 } = {},
): Promise<MediaAttachment> {
  let current = media;
  for (let i = 0; !current.url && i < attempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    current = await client.get<MediaAttachment>(`/api/v1/media/${media.id}`);
  }
  if (!current.url) throw new Error('Processing timed out');
  return current;
}
