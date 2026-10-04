import type { MastodonClient } from './client';
import type { Marker } from './types';

/** Mastodon ids are numeric strings (snowflakes): compare by length first, then alphabetically. */
export function compareIds(a: string, b: string): number {
  if (a.length !== b.length) return a.length - b.length;
  return a < b ? -1 : a > b ? 1 : 0;
}

export async function getHomeMarker(client: MastodonClient): Promise<Marker | null> {
  const res = await client.get<{ home?: Marker }>('/api/v1/markers?timeline[]=home');
  return res.home ?? null;
}

/**
 * Saves the reading position (also backwards: the position follows the reader). Skips the save if the
 * server already has the same id. Returns the marker the server stored.
 */
export async function saveHomeMarker(
  client: MastodonClient,
  lastReadId: string,
  current: string | null,
  keepalive = false,
): Promise<Marker | null> {
  if (current === lastReadId) return null;
  // keepalive: the request survives the page closing (pagehide)
  const res = await client.post<{ home?: Marker }>(
    '/api/v1/markers',
    { home: { last_read_id: lastReadId } },
    {},
    { keepalive },
  );
  return res.home ?? null;
}
