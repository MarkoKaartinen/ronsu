<script lang="ts">
  import { setContext, untrack } from 'svelte';
  import type { MastodonClient } from '../lib/api/client';
  import { getConversations, markConversationRead } from '../lib/api/conversations';
  import type { Account, Conversation } from '../lib/api/types';
  import { sanitizeText } from '../lib/html';
  import { t } from '../lib/stores/i18n.svelte';
  import { messages } from '../lib/stores/messages.svelte';
  import { push } from '../lib/stores/push.svelte';
  import StatusCard from './StatusCard.svelte';

  // active=false: stays mounted, hidden, while another view or a thread is open
  let { client, active = true }: { client: MastodonClient; active?: boolean } = $props();

  // The action buttons (reply, favorite, ...) use the same client
  // svelte-ignore state_referenced_locally
  setContext('mastodon-client', client);

  let items = $state<Conversation[]>([]);
  let loading = $state(false);
  let error = $state('');
  let end = $state(false);
  let loaded = $state(false);
  /** Where the next page of older conversations starts (from the Link header) */
  let cursor: string | undefined;

  const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
  /** A conversation with a post that is gone (deleted) has nothing to show */
  const shown = (list: Conversation[]) => list.filter((c) => c.last_status);

  /** The newest conversations: they replace the list (it is short, and the server orders it by the latest post) */
  async function refresh() {
    if (loading) return;
    loading = true;
    error = '';
    try {
      const page = await getConversations(client);
      items = shown(page.items);
      cursor = page.next ? (new URLSearchParams(page.next).get('max_id') ?? undefined) : undefined;
      end = !cursor;
      loaded = true;
      await markRead();
    } catch (e) {
      error = errorText(e);
    } finally {
      loading = false;
    }
  }

  async function loadMore() {
    if (loading || end || !cursor) return;
    loading = true;
    error = '';
    try {
      const page = await getConversations(client, cursor);
      const known = new Set(items.map((c) => c.id));
      items.push(...shown(page.items).filter((c) => !known.has(c.id)));
      cursor = page.next ? (new URLSearchParams(page.next).get('max_id') ?? undefined) : undefined;
      end = !cursor;
    } catch (e) {
      error = errorText(e);
    } finally {
      loading = false;
    }
  }

  /** Looking at the conversations reads them (on the server too, so every device agrees); the dots in the list stay for this visit */
  async function markRead() {
    if (!active || document.visibilityState !== 'visible' || !messages.canMarkRead()) return;
    await Promise.allSettled(items.filter((c) => c.unread).map((c) => markConversationRead(client, c.id)));
    await messages.check(client);
  }

  // Opened (again): the newest conversations
  $effect(() => {
    if (active) untrack(() => refresh());
  });
  // A push arrived while the view is open
  $effect(() => {
    if (push.signal > 0) untrack(() => active && loaded && refresh());
  });

  const names = (accounts: Account[]) => accounts.map((a) => `<strong>${sanitizeText(a.display_name || a.username, a.emojis)}</strong>`).join(', ');
  const withLine = (c: Conversation) => sanitizeText(t('messages.with', { names: '\u0001' })).replace('\u0001', names(c.accounts));
</script>

<div class="messages">
  <div class="list">
    {#each items as c (c.id)}
      <div class="item">
        <p class="note">
          {#if c.unread}<span class="dot" role="img" aria-label={t('nav.messagesNew')}></span>{/if}
          <span class="grow">{@html withLine(c)}</span>
        </p>
        <StatusCard status={c.last_status!} filterContext="home" markPrivate={false} />
      </div>
    {/each}
  </div>

  {#if error}
    <p class="msg error" role="alert">
      {error}
      <button onclick={() => (items.length ? loadMore() : refresh())}>{t('common.retry')}</button>
    </p>
  {/if}

  {#if loaded && !items.length && !error}
    <p class="msg">{t('messages.empty')}</p>
  {:else if items.length && !end}
    <div class="older">
      <button onclick={loadMore} disabled={loading}>{loading ? t('common.loading') : t('feed.loadOlder')}</button>
    </div>
  {/if}
</div>

<style>
  .note { display: flex; gap: 0.6rem; align-items: center; padding: 0.8rem 1rem 0; margin: 0; color: var(--muted); font-size: 0.9rem; }
  .note .grow { flex: 1; min-width: 0; overflow-wrap: anywhere; }
  .note :global(strong) { color: var(--text); }
  .note :global(img.emoji) { height: 1.2em; width: 1.2em; object-fit: contain; vertical-align: middle; }
  /* The same red as the ball on the bar's icon */
  .dot { flex: none; width: 0.6rem; height: 0.6rem; border-radius: 50%; background: var(--danger); }
  .item :global(article) { padding-top: 0.3rem; }
  .msg { text-align: center; color: var(--muted); padding: 1rem; margin: 0; }
  .msg.error { color: var(--danger); }
  .msg button { border: 1px solid var(--border); background: var(--bg); color: var(--text); border-radius: 0.4rem; padding: 0.3rem 0.8rem; }
  .older { text-align: center; padding: 0.8rem; }
  .older button { border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: 0.5rem; padding: 0.5rem 1.2rem; }
</style>
