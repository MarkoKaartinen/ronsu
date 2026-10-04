/** A reading position plus the time it was set. The newer time wins (last-write-wins). */
export interface Pos {
  id: string;
  at: number;
  /** The server's counter for the marker (only on positions that came from the server) */
  version?: number;
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
 *
 * When nothing of ours is waiting to be sent (our position is the one the server had), the server's own
 * version counter decides: a higher version is another device's update, whatever the clocks say. Only when
 * both sides have moved are the timestamps compared, and those are on the server's timeline (see clockOffset).
 */
export function isForeignUpdate(remote: Pos | null, lastSeen: Pos | null, current: Pos | null): boolean {
  if (!remote || remote.id === current?.id) return false;
  const nothingPending = !current || current.id === lastSeen?.id;
  if (nothingPending && remote.version !== undefined && lastSeen?.version !== undefined) {
    return remote.version > lastSeen.version;
  }
  if (lastSeen && remote.at <= lastSeen.at) return false;
  if (current && remote.at <= current.at) return false;
  return true;
}

/**
 * How far the device clock is from the server's: `updatedAt` is the server's time stamp of a save we just made,
 * `deviceNow` the device time at that moment (the request takes a fraction of a second, which is fine). Adding
 * the offset to `Date.now()` puts our own time stamps on the server's timeline, so a phone whose clock is a few
 * minutes off no longer loses (or wins) against another device by mistake.
 */
export function clockOffset(updatedAt: string, deviceNow: number): number {
  const server = Date.parse(updatedAt);
  return Number.isFinite(server) ? server - deviceNow : 0;
}
