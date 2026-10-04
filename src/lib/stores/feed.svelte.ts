import type { MastodonClient } from '../api/client';
import { tNow } from '../i18n/runtime';
import { getHomeMarker, saveHomeMarker } from '../api/markers';
import { isForeignUpdate, parsePos, pickStart, type Pos } from '../markerSync';
import type { Marker, Status } from '../api/types';
import { normalizePage, pageParams, PAGE_SIZE, type Order } from '../feedLogic';

const ORDER_KEY = 'reading-order';
/** Mastodon is written to at most this often (throttle): ~15 requests / 5 min, the limit is ~300 */
const SYNC_INTERVAL_MS = 20_000;

function readLocal(key: string): Pos | null {
  try {
    return parsePos(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function writeLocal(key: string, pos: Pos) {
  try {
    localStorage.setItem(key, JSON.stringify(pos));
  } catch {
    /* storage blocked: the server's copy is enough */
  }
}

function toPos(m: Marker | null | undefined): Pos | null {
  return m ? { id: m.last_read_id, at: Date.parse(m.updated_at) || 0 } : null;
}

function loadOrder(): Order {
  try {
    return localStorage.getItem(ORDER_KEY) === 'newest-first' ? 'newest-first' : 'oldest-first';
  } catch {
    return 'oldest-first';
  }
}

/** One account's home feed and its reading position. A new instance is created on every account switch. */
export class FeedStore {
  items = $state<Status[]>([]);
  order = $state<Order>(loadOrder());
  loading = $state(false);
  error = $state('');
  /** Everything fetched: the next page was empty */
  endReached = $state(false);
  /** Loading older posts (the button above the list) */
  olderLoading = $state(false);
  olderEnd = $state(false);
  /** The current reading position: it follows the reader, also backwards */
  marker = $state<string | null>(null);
  private markerAt = 0;
  /** The server state we know about (fetched or written by us) */
  private remote: Pos | null = null;
  /** The post the feed was restored from ("You left off here") */
  restoredId = $state<string | null>(null);
  /** Fetching/saving the reading position failed: shown to the user, not swallowed silently */
  markerError = $state('');
  /** Another device has moved the reading position: one can jump to this id */
  remoteAhead = $state<string | null>(null);

  private timer: ReturnType<typeof setTimeout> | undefined;
  private generation = 0;

  /** storageKey: per-account key for the local reading position */
  constructor(
    private client: MastodonClient,
    private storageKey: string,
  ) {}

  async start() {
    this.markerError = '';
    try {
      this.remote = toPos(await getHomeMarker(this.client));
    } catch (e) {
      this.markerError = tNow('feed.error.markerFetch', { message: errorMessage(e) });
    }
    // Whichever was set more recently wins (local vs. server), even when it is further back
    const start = pickStart(readLocal(this.storageKey), this.remote);
    this.marker = start?.id ?? null;
    this.markerAt = start?.at ?? 0;
    // Local is ahead (e.g. the page closed before syncing): send it to the server
    if (this.marker && this.marker !== this.remote?.id) this.scheduleSync();
    await this.load();
  }

  /** Resets the list and loads from the start: in oldest-first mode from the remembered post onwards. */
  private async load() {
    this.generation++;
    const gen = this.generation;
    this.items = [];
    this.endReached = false;
    this.olderEnd = false;
    this.error = '';
    this.loading = false;
    this.restoredId = null;

    if (this.order === 'oldest-first' && this.marker) {
      try {
        // `min_id` is exclusive: fetch the remembered post separately so it is the first item
        const status = await this.client.get<Status>(`/api/v1/statuses/${this.marker}`);
        if (gen !== this.generation) return;
        this.items = [status];
        this.restoredId = status.id;
      } catch {
        /* post deleted or unavailable: continue from the ones after it */
      }
    }
    await this.loadMore();
  }

  async setOrder(order: Order) {
    if (order === this.order) return;
    this.flush();
    this.order = order;
    try {
      localStorage.setItem(ORDER_KEY, order);
    } catch {
      /* storage unavailable */
    }
    await this.load();
  }

  async loadMore() {
    if (this.loading || this.endReached) return;
    const gen = this.generation;
    this.loading = true;
    this.error = '';
    try {
      const params = pageParams(this.order, this.items, this.marker);
      const page = await this.client.getPage<Status>('/api/v1/timelines/home', params);
      if (gen !== this.generation) return; // the situation changed during the fetch
      const fresh = normalizePage(this.order, page.items);
      if (fresh.length === 0) this.endReached = true;
      else this.items.push(...fresh);
    } catch (e) {
      if (gen === this.generation) this.error = errorMessage(e);
    } finally {
      if (gen === this.generation) this.loading = false;
    }
  }

  /** Loads older posts to the top of the list (oldest-first mode only). Never happens automatically. */
  async loadOlder() {
    if (this.order !== 'oldest-first' || this.olderLoading || this.olderEnd || !this.items.length) return;
    const gen = this.generation;
    this.olderLoading = true;
    this.error = '';
    try {
      const page = await this.client.getPage<Status>('/api/v1/timelines/home', {
        limit: PAGE_SIZE,
        max_id: this.items[0].id,
      });
      if (gen !== this.generation) return;
      const fresh = normalizePage('oldest-first', page.items);
      if (fresh.length === 0) this.olderEnd = true;
      else this.items.unshift(...fresh);
    } catch (e) {
      if (gen === this.generation) this.error = errorMessage(e);
    } finally {
      if (gen === this.generation) this.olderLoading = false;
    }
  }

  /** Oldest-first mode: check for new posts once we reach the end. */
  async checkForNew() {
    if (this.order !== 'oldest-first') return;
    this.endReached = false;
    await this.loadMore();
  }

  /** Records the reading position: locally right away, throttled towards Mastodon. Oldest-first mode only. */
  reportRead(id: string) {
    if (this.order !== 'oldest-first') return;
    if (id === this.marker) return;
    this.setMarker(id, Date.now());
    this.scheduleSync();
  }

  private setMarker(id: string, at: number) {
    this.marker = id;
    this.markerAt = at;
    writeLocal(this.storageKey, { id, at });
  }

  private scheduleSync() {
    if (this.timer) return; // throttle: continuous scrolling does not increase the number of requests
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.flush();
    }, SYNC_INTERVAL_MS);
  }

  /** Sends the reading position to Mastodon right away. keepalive = while the page is closing. */
  flush(keepalive = false) {
    clearTimeout(this.timer);
    this.timer = undefined;
    const id = this.marker;
    if (!id) return;
    saveHomeMarker(this.client, id, this.remote?.id ?? null, keepalive)
      .then((saved) => {
        if (!saved) return;
        // Remember the server's timestamp so our own save does not look like another device's update
        this.remote = toPos(saved);
        this.markerError = '';
      })
      .catch((e) => {
        this.markerError = tNow('feed.error.markerSave', { message: errorMessage(e) });
        this.scheduleSync(); // retry; the local copy is safe either way
      });
  }

  /** The page is visible again: has another device moved the reading position more recently? */
  async checkRemote() {
    try {
      const remote = toPos(await getHomeMarker(this.client));
      const current = this.marker ? { id: this.marker, at: this.markerAt } : null;
      if (remote && isForeignUpdate(remote, this.remote, current)) this.remoteAhead = remote.id;
      if (remote && (!this.remote || remote.at > this.remote.at)) this.remote = remote;
    } catch {
      /* offline: skip */
    }
  }

  async jumpToRemote() {
    const id = this.remoteAhead;
    if (!id) return;
    this.remoteAhead = null;
    this.setMarker(id, this.remote?.at ?? Date.now());
    await this.load();
  }

  dismissRemote() {
    this.remoteAhead = null;
  }

  destroy() {
    this.flush(true);
    this.generation++;
  }
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
