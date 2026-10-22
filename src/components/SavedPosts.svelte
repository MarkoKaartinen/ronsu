<script lang="ts">
  import { setContext, untrack } from 'svelte';
  import { cursorOf, type MastodonClient } from '../lib/api/client';
  import { getSaved, type SavedKind } from '../lib/api/saved';
  import type { Status } from '../lib/api/types';
  import { t } from '../lib/stores/i18n.svelte';
  import StatusCard from './StatusCard.svelte';
  import TitleBar from './TitleBar.svelte';

  // A new one per account (App keys it). active=false: stays mounted, hidden, while a thread or another view is open
  let { client, kind, active = true }: { client: MastodonClient; kind: SavedKind; active?: boolean } = $props();

  // The action buttons (reply, favorite, ...) use the same client
  // svelte-ignore state_referenced_locally
  setContext('mastodon-client', client);

  let items = $state<Status[]>([]);
  let loading = $state(false);
  let error = $state('');
  let end = $state(false);
  let loaded = $state(false);
  /** Where the next page starts: the server's own counter for the list (from the Link header) */
  let cursor: string | undefined;

  async function load(more: boolean) {
    if (loading || (more && (end || !cursor))) return;
    loading = true;
    error = '';
    try {
      const page = await getSaved(client, kind, more ? cursor : undefined);
      if (more) {
        const known = new Set(items.map((s) => s.id));
        items.push(...page.items.filter((s) => !known.has(s.id)));
      } else {
        items = page.items; // opened (again): the newest ones replace the list, it may have changed meanwhile
      }
      cursor = cursorOf(page.next);
      end = !cursor;
      loaded = true;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (active) untrack(() => load(false));
  });
</script>

<div class="saved">
  <TitleBar title={t(kind === 'bookmarks' ? 'nav.bookmarks' : 'nav.favourites')} />
  {#each items as status (status.id)}
    <StatusCard {status} />
  {/each}

  {#if error}
    <p class="msg error" role="alert">
      {error}
      <button onclick={() => load(items.length > 0)}>{t('common.retry')}</button>
    </p>
  {/if}

  {#if loading && !items.length}
    <p class="msg">{t('common.loading')}</p>
  {:else if loaded && !items.length && !error}
    <p class="msg">{t(kind === 'bookmarks' ? 'saved.emptyBookmarks' : 'saved.emptyFavourites')}</p>
  {:else if items.length && !end}
    <div class="older">
      <button onclick={() => load(true)} disabled={loading}>{loading ? t('common.loading') : t('feed.loadOlder')}</button>
    </div>
  {/if}
</div>

<style>
  .msg { text-align: center; color: var(--muted); padding: 1rem; margin: 0; }
  .msg.error { color: var(--danger); }
  .msg button { border: 1px solid var(--border); background: var(--bg); color: var(--text); border-radius: 0.4rem; padding: 0.3rem 0.8rem; }
  .older { text-align: center; padding: 0.8rem; }
  .older button { border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: 0.5rem; padding: 0.5rem 1.2rem; }
</style>
