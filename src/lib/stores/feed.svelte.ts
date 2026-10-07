import type { MastodonClient } from '../api/client';
import { tNow } from '../i18n/runtime';
import { compareIds, getHomeMarker, saveHomeMarker } from '../api/markers';
import { clockOffset, isForeignUpdate, parsePos, pickStart, type Pos } from '../markerSync';
import type { Marker, Status } from '../api/types';
import { advanceMarker, normalizePage, pageParams, PAGE_SIZE, type Order } from '../feedLogic';

const ORDER_KEY = 'reading-order';
/** Where this device's clock is relative to the server's (ms), learned from our own saves */
const CLOCK_KEY = 'marker-clock-offset';
/**
 * The position goes to Mastodon at most this often (throttle): at most ~60 requests / 5 min while scrolling
 * continuously, where the limit is ~300. A short interval matters: another device only sees the position once it
 * has been sent, and a phone is often put away within seconds.
 */
const SYNC_INTERVAL_MS = 5_000;

/**
 * New posts are added above the screen and are painted for the first time when the reader scrolls up to them, so
 * their pictures would be fetched and decoded in the first frames of that scroll (a visible hitch). Fetching and
 * decoding them before the posts are added moves that work to the moment of the click. It waits at most a moment
 * and ignores errors, so a slow connection never holds back the list.
 */
const WARM_TIMEOUT_MS = 1000;

function warmImages(posts: Status[]): Promise<void> {
  const urls = new Set<string>();
  for (const p of posts) {
    const s = p.reblog ?? p;
    urls.add(s.account.avatar);
    for (const m of s.media_attachments) if (m.preview_url) urls.add(m.preview_url);
  }
  const decoded = [...urls].map((url) => {
    const img = new Image();
    img.src = url;
    return img.decode().catch(() => {});
  });
  return Promise.race([Promise.all(decoded).then(() => {}), new Promise<void>((r) => setTimeout(r, WARM_TIMEOUT_MS))]);
}

const MAX_PARENT_FETCHES = 15;
const PARENT_TIMEOUT_MS = 1500;

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
  return m ? { id: m.last_read_id, at: Date.parse(m.updated_at) || 0, version: m.version } : null;
}

function readClockOffset(): number {
  try {
    return Number(localStorage.getItem(CLOCK_KEY)) || 0;
  } catch {
    return 0;
  }
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
  /**
   * The posts that replies in the list answer, shown above them. They are fetched before the replies are added to
   * the list (not when they are rendered), because a parent appearing above a post that is already on screen would
   * push the page down: Safari has no scroll anchoring. Not reactive on purpose, it is filled before `items` changes.
   */
  private parents = new Map<string, Status>();
  order = $state<Order>(loadOrder());
  loading = $state(false);
  error = $state('');
  /** Everything fetched: the next page was empty */
  endReached = $state(false);
  /** Loading older posts (the button above the list) */
  olderLoading = $state(false);
  olderEnd = $state(false);
  /** Loading newer posts (the button above the list in newest-first mode) */
  newerLoading = $state(false);
  /** The last "Load new" found nothing: shown briefly instead of a silent no-op */
  newerNone = $state(false);
  private newerNoneTimer: ReturnType<typeof setTimeout> | undefined;
  /** The current reading position: it follows the reader, also backwards */
  marker = $state<string | null>(null);
  private markerAt = 0;
  /**
   * Newest-first mode: where the reading position was when the list was loaded. The divider stays there while
   * the position moves on, otherwise it would shift the posts around under the reader's thumb.
   */
  dividerMarker = $state<string | null>(null);
  /** Newest-first mode: the posts that have been on screen since the list was loaded */
  private seen = new Set<string>();
  /** The server state we know about (fetched or written by us) */
  private remote: Pos | null = null;
  /** The post the feed was restored from ("You left off here") */
  restoredId = $state<string | null>(null);
  /** Fetching/saving the reading position failed: shown to the user, not swallowed silently */
  markerError = $state('');
  /** The lowest post on screen = the newest one the reader has seen (oldest-first mode) */
  viewedId = $state<string | null>(null);
  /**
   * When the newest post of the home timeline was made (ms), as far as we know. The reading position is
   * compared to it ("you are 3h behind"): a measure that does not depend on how much of the list has been
   * loaded, so it falls steadily as you read and does not jump when the next page arrives.
   */
  latestAt = $state<number | null>(null);
  /** Another device has moved the reading position: one can jump to this id */
  remoteAhead = $state<string | null>(null);
  /** The feed opened at the position another device had left, not at this device's own one: said out loud */
  continuedFromRemote = $state(false);

  private timer: ReturnType<typeof setTimeout> | undefined;
  /**
   * The reading position has moved and the server has not confirmed it yet. Unlike `timer` this survives a send
   * that never arrived (a phone freezes the page, the keepalive request is dropped), so it is retried on resume.
   */
  private dirty = false;
  private generation = 0;
  /** Device clock -> server clock (ms): our own time stamps are on the server's timeline, see clockOffset() */
  private clockOffset = readClockOffset();

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
    this.continuedFromRemote = !!start && start === this.remote && start.id !== readLocal(this.storageKey)?.id;
    // Local is ahead (e.g. the page closed before syncing): send it to the server
    if (this.marker && this.marker !== this.remote?.id) {
      this.dirty = true;
      this.scheduleSync();
    }
    await this.load();
  }

  /** Resets the list and loads from the start: in oldest-first mode from the remembered post onwards. */
  private async load() {
    this.generation++;
    const gen = this.generation;
    this.refreshLatest();
    this.items = [];
    this.endReached = false;
    this.olderEnd = false;
    this.error = '';
    // While the remembered post is being fetched the list is empty but not idle: without this the infinite scroll
    // (the end of the empty list is in view) would ask for a page of its own that lands in the list twice
    this.loading = !!this.marker;
    this.restoredId = null;
    this.viewedId = null;
    this.dividerMarker = this.marker;
    this.seen = new Set();

    if (this.marker) {
      try {
        // `min_id` is exclusive: fetch the remembered post separately so it is part of the list
        const status = await this.client.get<Status>(`/api/v1/statuses/${this.marker}`);
        if (gen !== this.generation) return;
        if (this.order === 'oldest-first') {
          await this.loadParents([status]);
          if (gen !== this.generation) return;
          this.items = [status];
        } else {
          // Newest first starts from the same place and is read upwards: the posts right after the remembered one
          // go above it (more of them come from the button above the list), older ones follow below
          const page = await this.client.getPage<Status>('/api/v1/timelines/home', { limit: PAGE_SIZE, min_id: this.marker });
          if (gen !== this.generation) return;
          const newer = normalizePage('newest-first', page.items);
          for (const s of newer) this.noteLatest(s.created_at);
          // The older ones are fetched in the same go: the divider is scrolled to the top of the screen, which needs
          // posts below it from the start, or the page would first be too short and the divider would jump into place
          const older = await this.client.getPage<Status>('/api/v1/timelines/home', { limit: PAGE_SIZE, max_id: status.id });
          if (gen !== this.generation) return;
          const below = notIn([...newer, status], normalizePage('newest-first', older.items));
          for (const s of below) this.noteLatest(s.created_at);
          this.endReached = below.length === 0;
          await this.loadParents([...newer, status, ...below]);
          if (gen !== this.generation) return;
          this.items = [...newer, status, ...below];
        }
        this.restoredId = status.id;
      } catch {
        /* post deleted or unavailable: continue from the ones after it */
      }
    }
    if (gen !== this.generation) return;
    this.loading = false;
    if (!this.restoredId || this.order === 'oldest-first') await this.loadMore();
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
    this.syncPending();
    const gen = this.generation;
    this.loading = true;
    this.error = '';
    try {
      const params = pageParams(this.order, this.items, this.marker);
      const page = await this.client.getPage<Status>('/api/v1/timelines/home', params);
      if (gen !== this.generation) return; // the situation changed during the fetch
      const fresh = notIn(this.items, normalizePage(this.order, page.items));
      for (const s of fresh) this.noteLatest(s.created_at);
      if (fresh.length === 0) this.endReached = true;
      else {
        await this.loadParents(fresh);
        if (gen !== this.generation) return;
        this.items.push(...fresh);
      }
    } catch (e) {
      if (gen === this.generation) this.error = errorMessage(e);
    } finally {
      if (gen === this.generation) this.loading = false;
    }
  }

  /** Loads older posts to the top of the list (oldest-first mode only). Never happens automatically. */
  async loadOlder() {
    if (this.order !== 'oldest-first' || this.olderLoading || this.olderEnd || !this.items.length) return;
    this.syncPending();
    const gen = this.generation;
    this.olderLoading = true;
    this.error = '';
    try {
      const page = await this.client.getPage<Status>('/api/v1/timelines/home', {
        limit: PAGE_SIZE,
        max_id: this.items[0].id,
      });
      if (gen !== this.generation) return;
      const fresh = notIn(this.items, normalizePage('oldest-first', page.items));
      if (fresh.length === 0) this.olderEnd = true;
      else {
        await this.loadParents(fresh);
        if (gen !== this.generation) return;
        this.items.unshift(...fresh);
      }
    } catch (e) {
      if (gen === this.generation) this.error = errorMessage(e);
    } finally {
      if (gen === this.generation) this.olderLoading = false;
    }
  }

  /**
   * Newest-first mode: loads the posts newer than the first one to the top of the list. `min_id` returns the
   * posts directly after it, so the list stays gapless; if there are more than a page the button stays.
   */
  async loadNewer() {
    if (this.order !== 'newest-first' || this.newerLoading || !this.items.length) return;
    const gen = this.generation;
    this.newerLoading = true;
    this.newerNone = false;
    clearTimeout(this.newerNoneTimer);
    this.error = '';
    try {
      const page = await this.client.getPage<Status>('/api/v1/timelines/home', {
        limit: PAGE_SIZE,
        min_id: this.items[0].id,
      });
      if (gen !== this.generation) return;
      const fresh = notIn(this.items, normalizePage('newest-first', page.items));
      for (const s of fresh) this.noteLatest(s.created_at);
      if (fresh.length === 0) {
        this.newerNone = true;
        this.newerNoneTimer = setTimeout(() => (this.newerNone = false), 3000);
      } else {
        await Promise.all([warmImages(fresh), this.loadParents(fresh)]);
        if (gen !== this.generation) return;
        this.items.unshift(...fresh);
      }
    } catch (e) {
      if (gen === this.generation) this.error = errorMessage(e);
    } finally {
      if (gen === this.generation) this.newerLoading = false;
    }
  }

  /** The post that `status` is a reply to, when it is known (a boost has none: the original's context is not shown) */
  parentOf(status: Status): Status | undefined {
    return !status.reblog && status.in_reply_to_id ? this.parents.get(status.in_reply_to_id) : undefined;
  }

  /**
   * Makes the parents of the replies in `posts` known before the posts are shown. Posts that are in the list
   * already cost nothing; the rest are fetched in parallel, a limited number per page and for a limited time,
   * and a failure only means that the reply is shown without its parent.
   */
  private async loadParents(posts: Status[]) {
    for (const p of [...this.items, ...posts]) if (!this.parents.has(p.id)) this.parents.set(p.id, p);
    const missing = [
      ...new Set(posts.flatMap((p) => (!p.reblog && p.in_reply_to_id && !this.parents.has(p.in_reply_to_id) ? [p.in_reply_to_id] : []))),
    ].slice(0, MAX_PARENT_FETCHES);
    if (!missing.length) return;
    const fetched = missing.map((id) =>
      this.client.get<Status>(`/api/v1/statuses/${id}`).then(
        (parent) => void this.parents.set(id, parent),
        () => {},
      ),
    );
    await Promise.race([Promise.all(fetched), new Promise((r) => setTimeout(r, PARENT_TIMEOUT_MS))]);
  }

  /** Oldest-first mode: check for new posts once we reach the end. */
  async checkForNew() {
    if (this.order !== 'oldest-first') return;
    this.syncPending();
    this.endReached = false;
    this.refreshLatest();
    await this.loadMore();
  }

  /** Asks for the newest post of the home timeline (one small request). */
  async refreshLatest() {
    try {
      const [newest] = await this.client.get<Status[]>('/api/v1/timelines/home', { limit: 1 });
      if (newest) this.noteLatest(newest.created_at);
    } catch {
      /* offline or a hiccup: the loaded posts still tell the newest we have seen */
    }
  }

  private noteLatest(createdAt: string) {
    const at = Date.parse(createdAt);
    if (Number.isFinite(at) && (this.latestAt === null || at > this.latestAt)) this.latestAt = at;
  }

  /** Records the reading position: locally right away, throttled towards Mastodon. Oldest-first mode only. */
  reportRead(id: string) {
    if (this.order !== 'oldest-first') return;
    if (id === this.marker) return;
    this.setMarker(id, this.serverNow());
    this.dirty = true;
    this.scheduleSync();
  }

  /**
   * Newest-first mode: the posts on screen right now (any order). The reading position follows the reader in
   * either direction, see advanceMarker(), and never moves back. Without a position yet, the lowest post on
   * screen becomes it.
   */
  reportScreen(ids: string[]) {
    if (this.order !== 'newest-first' || !ids.length) return;
    for (const id of ids) this.seen.add(id);
    let next: string | null;
    if (!this.marker) next = [...ids].sort(compareIds)[0];
    else next = advanceMarker(this.items, this.marker, this.seen);
    if (!next || next === this.marker || (this.marker && compareIds(next, this.marker) < 0)) return;
    this.setMarker(next, this.serverNow());
    this.dirty = true;
    this.scheduleSync();
  }

  /**
   * Fetching more posts is a good moment to send the reading position as well: the connection is clearly up and
   * the reader has just been moving. Does not wait for the throttle timer and is not awaited.
   */
  private syncPending() {
    if (this.dirty) void this.flush();
  }

  /** The current time on the server's clock (an estimate; exact once we have made a save). */
  private serverNow(): number {
    return Date.now() + this.clockOffset;
  }

  private learnClock(updatedAt: string) {
    this.clockOffset = clockOffset(updatedAt, Date.now());
    try {
      localStorage.setItem(CLOCK_KEY, String(this.clockOffset));
    } catch {
      /* storage blocked: the offset is learned again on the next save */
    }
  }

  reportViewed(id: string) {
    if (this.order === 'oldest-first') this.viewedId = id;
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
  flush(keepalive = false): Promise<void> {
    clearTimeout(this.timer);
    this.timer = undefined;
    const id = this.marker;
    if (!id) return Promise.resolve();
    return saveHomeMarker(this.client, id, this.remote?.id ?? null, keepalive)
      .then((saved) => {
        if (!saved) {
          if (this.marker === id) this.dirty = false; // the server already had it
          return;
        }
        if (this.marker === id) this.dirty = false;
        // Remember the server's timestamp so our own save does not look like another device's update
        this.remote = toPos(saved);
        this.learnClock(saved.updated_at);
        this.markerError = '';
      })
      .catch((e) => {
        this.markerError = tNow('feed.error.markerSave', { message: errorMessage(e) });
        this.scheduleSync(); // retry; the local copy is safe either way
      });
  }

  /**
   * The app is back in front (or online again, or a minute has passed): send what we have not sent yet, so the
   * other devices can see it, and look whether another device has moved the position.
   */
  async resume() {
    if (this.dirty) await this.flush();
    await Promise.all([this.checkRemote(), this.refreshLatest()]);
  }

  /** Has another device moved the reading position more recently? */
  async checkRemote() {
    try {
      const remote = toPos(await getHomeMarker(this.client));
      const current = this.marker ? { id: this.marker, at: this.markerAt } : null;
      if (remote && isForeignUpdate(remote, this.remote, current)) this.remoteAhead = remote.id;
      if (remote && (!this.remote || remote.at > this.remote.at || (remote.version ?? 0) > (this.remote.version ?? 0))) this.remote = remote;
    } catch {
      /* offline: skip */
    }
  }

  async jumpToRemote() {
    const id = this.remoteAhead;
    if (!id) return;
    this.remoteAhead = null;
    this.continuedFromRemote = false;
    this.dirty = false;
    this.setMarker(id, this.remote?.at ?? this.serverNow());
    await this.load();
  }

  dismissRemote() {
    this.remoteAhead = null;
  }

  dismissContinued() {
    this.continuedFromRemote = false;
  }

  destroy() {
    this.flush(true);
    this.generation++;
  }
}

/** Posts that are not in the list yet: a post must never be in it twice (it is the key of the rendered item) */
function notIn(items: Status[], page: Status[]): Status[] {
  const have = new Set(items.map((s) => s.id));
  return page.filter((s) => !have.has(s.id));
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
