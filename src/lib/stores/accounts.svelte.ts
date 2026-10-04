import { get, set } from 'idb-keyval';
import { MastodonClient } from '../api/client';
import { revokeToken } from '../api/oauth';
import type { StoredAccount } from '../api/types';

const ACCOUNTS_KEY = 'accounts';
const ACTIVE_KEY = 'active-account';

class AccountStore {
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
    if (i >= 0) this.accounts[i] = account;
    else this.accounts.push(account);
    this.activeKey = account.key;
    await this.persist();
  }

  async switchTo(key: string) {
    if (!this.accounts.some((a) => a.key === key)) return;
    this.activeKey = key;
    await this.persist();
  }

  async remove(key: string) {
    const acc = this.accounts.find((a) => a.key === key);
    if (!acc) return;
    await revokeToken($state.snapshot(acc));
    this.accounts = this.accounts.filter((a) => a.key !== key);
    if (this.activeKey === key) this.activeKey = this.accounts[0]?.key ?? null;
    await this.persist();
  }

  client(): MastodonClient | null {
    const a = this.active;
    return a ? new MastodonClient({ instance: a.instance, token: a.token }) : null;
  }
}

export const accountStore = new AccountStore();
