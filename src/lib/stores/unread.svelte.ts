import type { MastodonClient } from '../api/client';
import { getNotificationsMarker, isUnread, saveNotificationsMarker } from '../api/markers';
import type { Notification } from '../api/types';
import { PUSH_TYPES } from '../pushLogic';
import { push } from './push.svelte';

/** The title of the page, which gets a mark in front of it while there is something unread */
const TITLE = 'Ronsu';

/**
 * Is there a notification the reader has not seen? Seen means what the server's `notifications` marker says (shared
 * with Mastodon's own apps): the marker moves up when the notifications have been looked at.
 */
class UnreadStore {
  hasNew = $state(false);
  private newest: string | null = null;

  /** Asks the server: the newest notification of the kinds Ronsu lists, against the marker */
  async check(client: MastodonClient) {
    try {
      const types = PUSH_TYPES.map((t) => `types[]=${t}`).join('&');
      const [latest, marker] = await Promise.all([
        client.get<Notification[]>(`/api/v1/notifications?limit=1&${types}`),
        getNotificationsMarker(client),
      ]);
      this.newest = latest[0]?.id ?? null;
      this.hasNew = isUnread(this.newest, marker?.last_read_id ?? null);
    } catch {
      /* offline or the server is busy: whatever is shown stays, the next check corrects it */
    }
  }

  /** The reader is looking at the notifications: everything up to the newest is seen */
  async seen(client: MastodonClient) {
    await this.check(client);
    if (!this.hasNew || !this.newest) return;
    const id = this.newest;
    this.hasNew = false;
    try {
      await saveNotificationsMarker(client, id);
    } catch {
      this.hasNew = true; // not saved: it would show as unread on every other device
    }
  }

  /** Shows the state in the page title and on the app icon; called from an $effect */
  apply() {
    document.title = this.hasNew ? `(•) ${TITLE}` : TITLE;
    const nav = navigator as Navigator & { setAppBadge?: () => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (this.hasNew && push.prefs.badge) void nav.setAppBadge?.().catch(() => {});
    else void nav.clearAppBadge?.().catch(() => {});
  }
}

export const unread = new UnreadStore();
