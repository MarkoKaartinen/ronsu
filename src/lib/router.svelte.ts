/** `handle` of a profile: "@user@server" (the usual form) or a numeric account id (older links). */
export type Route = { name: 'home' } | { name: 'notifications' } | { name: 'thread'; id: string } | { name: 'profile'; handle: string };

/** Link to a profile, e.g. `#/user/@magdalenahai@mstdn.social`. */
export const profileHref = (acct: string) => `#/user/@${encodeURI(acct)}`;

function parse(hash: string): Route {
  if (hash === '#/notifications') return { name: 'notifications' };
  const t = hash.match(/^#\/thread\/(\d+)$/);
  if (t) return { name: 'thread', id: t[1] };
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
 * Hash routing (`#/thread/ID`, `#/user/@user@server`), so the server needs no rewrite rules. The home scroll
 * position is remembered when a thread opens and restored on the way back.
 */
class Router {
  route = $state<Route>(parse(location.hash));
  /** The scroll position of each of the two main views, kept while a thread or a profile is open (or the other view) */
  tabScroll: Record<string, number> = { home: 0, notifications: 0 };

  constructor() {
    // Restoring the scroll position is the app's job; the browser's own would compete with it
    history.scrollRestoration = 'manual';
    const sync = () => this.set(parse(location.hash));
    addEventListener('popstate', sync);
    addEventListener('hashchange', sync);
  }

  private set(next: Route) {
    if (JSON.stringify(next) === JSON.stringify(this.route)) return;
    if (this.route.name === 'home' || this.route.name === 'notifications') this.tabScroll[this.route.name] = window.scrollY;
    this.route = next;
  }

  /** Switches between the two main views (the bottom bar) */
  openTab(name: 'home' | 'notifications') {
    if (this.route.name === name) return;
    history.pushState({ inApp: true }, '', name === 'home' ? location.pathname + location.search : '#/notifications');
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
