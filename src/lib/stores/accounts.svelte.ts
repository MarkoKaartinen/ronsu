import { get, set } from 'idb-keyval';
import { MastodonClient } from '../api/client';
import { revokeToken, type RevokeResult } from '../api/oauth';
import type { StoredAccount, Visibility } from '../api/types';

const ACCOUNTS_KEY = 'accounts';
const ACTIVE_KEY = 'active-account';

/** Tells the other tabs of this browser that an account was logged out, so none of them keeps its token in memory */
const LOGOUT_CHANNEL = 'ronsu-logout';

class AccountStore {
  private channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(LOGOUT_CHANNEL);

  constructor() {
    if (this.channel) {
      this.channel.onmessage = (e: MessageEvent) => {
        if (e.data?.type === 'logout' && typeof e.data.key === 'string') this.forget(e.data.key);
      };
    }
  }

  accounts = $state<StoredAccount[]>([]);
  activeKey = $state<string | null>(null);
  ready = $state(false);

  active = $derived(this.accounts.find((a) => a.key === this.activeKey) ?? null);

  async load() {
    this.accounts = (await get<StoredAccount[]>(ACCOUNTS_KEY)) ?? [];
    const saved = await get<string>(ACTIVE_KEY);
    this.activeKey = this.accounts.some((a) => a.key === saved) ? saved! : (this.accounts[0]?.key ?? null);
    this.ready = true;
  }

  private async persist() {
    // $state proxies must be unwrapped before writing to IndexedDB
    await set(ACCOUNTS_KEY, $state.snapshot(this.accounts));
    await set(ACTIVE_KEY, this.activeKey);
  }

  async add(account: StoredAccount) {
    const i = this.accounts.findIndex((a) => a.key === account.key);
    if (i >= 0) {
      // Logging in again (new permissions): the token it replaces would otherwise stay valid on the server
      const old = $state.snapshot(this.accounts[i]);
      if (old.token !== account.token) void revokeToken(old);
      this.accounts[i] = account;
    } else this.accounts.push(account);
    this.activeKey = account.key;
    await this.persist();
  }

  /** The account's default posting privacy, as the server last told it */
  async setDefaultPrivacy(key: string, privacy: Visibility) {
    const acc = this.accounts.find((a) => a.key === key);
    if (!acc || acc.defaultPrivacy === privacy) return;
    acc.defaultPrivacy = privacy;
    await this.persist();
  }

  async switchTo(key: string) {
    if (!this.accounts.some((a) => a.key === key)) return;
    this.activeKey = key;
    await this.persist();
  }

  /** Drops an account from memory only (another tab has logged it out and has stored that already) */
  private forget(key: string) {
    this.accounts = this.accounts.filter((a) => a.key !== key);
    if (this.activeKey === key) this.activeKey = this.accounts[0]?.key ?? null;
  }

  /**
   * Logs an account out. The local session is closed first and for certain (memory, storage, the other tabs), it
   * never waits for the server. Then the token is revoked on the server and the result is returned: the caller
   * must not say the access was revoked unless `ok`. A token that could not be revoked is not kept anywhere:
   * the way to remove it is the server's own list of authorized apps.
   */
  async remove(key: string): Promise<RevokeResult | null> {
    const acc = this.accounts.find((a) => a.key === key);
    if (!acc) return null;
    const snapshot = $state.snapshot(acc);
    this.forget(key);
    this.channel?.postMessage({ type: 'logout', key });
    let stored: unknown;
    try {
      await this.persist();
    } catch (e) {
      stored = e;
    }
    const result = await revokeToken(snapshot);
    if (stored) throw stored;
    return result;
  }

  client(): MastodonClient | null {
    const a = this.active;
    return a ? new MastodonClient({ instance: a.instance, token: a.token }) : null;
  }
}

export const accountStore = new AccountStore();
