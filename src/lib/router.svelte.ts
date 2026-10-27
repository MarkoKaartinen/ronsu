/** `handle` of a profile: "@user@server" (the usual form) or a numeric account id (older links). */
export type MainView = 'home' | 'notifications' | 'messages';
/** A list of the posts the reader has saved: a page of its own, like a thread, opened from the settings or the sidebar */
export type SavedView = 'bookmarks' | 'favourites';
export type Route = { name: MainView } | { name: SavedView } | { name: 'settings' } | { name: 'thread'; id: string } | { name: 'profile'; handle: string } | { name: 'tag'; tag: string };

/** Link to a profile, e.g. `#/user/@magdalenahai@mstdn.social`. */
export const profileHref = (acct: string) => `#/user/@${encodeURI(acct)}`;

/** Link to the view of a hashtag, e.g. `#/tag/ronsu` (without the `#` of the hashtag) */
export const tagHref = (name: string) => `#/tag/${encodeURIComponent(name)}`;

function parse(hash: string): Route {
  if (hash === '#/notifications') return { name: 'notifications' };
  if (hash === '#/messages') return { name: 'messages' };
  if (hash === '#/settings') return { name: 'settings' };
  if (hash === '#/bookmarks') return { name: 'bookmarks' };
  if (hash === '#/favourites') return { name: 'favourites' };
  const t = hash.match(/^#\/thread\/(\d+)$/);
  if (t) return { name: 'thread', id: t[1] };
  const tag = hash.match(/^#\/tag\/([^/?#]+)$/);
  if (tag) {
    try {
      return { name: 'tag', tag: decodeURIComponent(tag[1]) };
    } catch {
      /* malformed percent-encoding: treat as no route */
    }
  }
  const byId = hash.match(/^#\/user\/(\d+)$/);
  if (byId) return { name: 'profile', handle: byId[1] };
  const byAcct = hash.match(/^#\/user\/(@[^/?#]+)$/);
  if (byAcct) {
    try {
      return { name: 'profile', handle: decodeURIComponent(byAcct[1]) };
    } catch {
      /* malformed percent-encoding: treat as no route */
    }
  }
  return { name: 'home' };
}

/**
 * Hash routing (`#/thread/ID`, `#/user/@user@server`, `#/tag/name`), so the server needs no rewrite rules. The home scroll
 * position is remembered when a thread opens and restored on the way back.
 */
class Router {
  route = $state<Route>(parse(location.hash));
  /** The scroll position of each of the main views, kept while a thread or a profile is open (or another view) */
  tabScroll: Record<string, number> = { home: 0, notifications: 0, messages: 0, bookmarks: 0, favourites: 0, settings: 0 };

  constructor() {
    // Restoring the scroll position is the app's job; the browser's own would compete with it
    history.scrollRestoration = 'manual';
    const sync = () => this.set(parse(location.hash));
    addEventListener('popstate', sync);
    addEventListener('hashchange', sync);
  }

  private set(next: Route) {
    if (JSON.stringify(next) === JSON.stringify(this.route)) return;
    if (this.route.name in this.tabScroll) this.tabScroll[this.route.name] = window.scrollY;
    this.route = next;
  }

  /** Switches between the main views (the bottom bar, the sidebar) */
  openTab(name: MainView) {
    if (this.route.name === name) return;
    history.pushState({ inApp: true }, '', name === 'home' ? location.pathname + location.search : `#/${name}`);
    this.set({ name });
  }

  /** The account and settings page: beside the sidebar on a wide screen, over everything on a phone */
  openSettings() {
    if (this.route.name === 'settings') return;
    history.pushState({ inApp: true }, '', '#/settings');
    this.set({ name: 'settings' });
  }

  openSaved(name: SavedView) {
    if (this.route.name === name) return;
    history.pushState({ inApp: true }, '', `#/${name}`);
    this.set({ name });
  }

  openThread(id: string) {
    history.pushState({ inApp: true }, '', `#/thread/${id}`);
    this.set({ name: 'thread', id });
  }

  openProfile(account: { acct: string }) {
    history.pushState({ inApp: true }, '', profileHref(account.acct));
    this.set({ name: 'profile', handle: `@${account.acct}` });
  }

  openTag(name: string) {
    history.pushState({ inApp: true }, '', tagHref(name));
    this.set({ name: 'tag', tag: name });
  }

  /** Back: the app's own history, or home if the thread was opened directly from a link. */
  back() {
    if (history.state?.inApp) {
      history.back();
    } else {
      history.replaceState(null, '', location.pathname + location.search);
      this.set({ name: 'home' });
    }
  }
}

export const router = new Router();
