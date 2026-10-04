/** A reading position plus the time it was set. The newer time wins (last-write-wins). */
export interface Pos {
  id: string;
  at: number;
}

/** Parses a stored value. The old format (a bare id) gets time 0, so the server wins. */
export function parsePos(raw: string | null): Pos | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (v && typeof v.id === 'string' && typeof v.at === 'number') return { id: v.id, at: v.at };
  } catch {
    /* not JSON: the old format */
  }
  return /^\d+$/.test(raw) ? { id: raw, at: 0 } : null;
}

/** On start-up: whichever was set more recently wins, even when it is further back. */
export function pickStart(local: Pos | null, remote: Pos | null): Pos | null {
  if (!local) return remote;
  if (!remote) return local;
  return local.at > remote.at ? local : remote;
}

/**
 * Is there a newer update on the server made by another device?
 * - `lastSeen`: the server state we know about (our own saves update it, so no false alarm)
 * - `current`: our own current position; if we have moved since, ours wins
 */
export function isForeignUpdate(remote: Pos | null, lastSeen: Pos | null, current: Pos | null): boolean {
  if (!remote || remote.id === current?.id) return false;
  if (lastSeen && remote.at <= lastSeen.at) return false;
  if (current && remote.at <= current.at) return false;
  return true;
}
