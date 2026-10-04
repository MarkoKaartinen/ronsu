<script lang="ts">
  import { onMount, setContext, tick, untrack } from 'svelte';
  import type { MastodonClient } from '../lib/api/client';
  import { getContext, getStatus } from '../lib/api/statuses';
  import type { Context, Status } from '../lib/api/types';
  import { accountStore } from '../lib/stores/accounts.svelte';
  import { t } from '../lib/stores/i18n.svelte';
  import { composer } from '../lib/stores/composer.svelte';
  import { threadRows } from '../lib/threadLogic';
  import StatusCard from './StatusCard.svelte';

  let { client, id }: { client: MastodonClient; id: string } = $props();

  // The action buttons (ActionBar) get the client from the context
  // svelte-ignore state_referenced_locally
  setContext('mastodon-client', client);

  let focused = $state<Status | null>(null);
  let ctx = $state<Context | null>(null);
  let loading = $state(true);
  let error = $state('');
  let root: HTMLElement | undefined = $state();

  const rows = $derived(focused && ctx ? threadRows(ctx, focused) : []);
  const focusIdx = $derived(rows.findIndex((r) => r.focused));

  async function load(scrollToFocused: boolean) {
    error = '';
    try {
      const [status, context] = await Promise.all([getStatus(client, id), getContext(client, id)]);
      focused = status;
      ctx = context;
      // The rows are only rendered once loading has finished: scroll only after that
      loading = false;
      if (scrollToFocused) {
        await tick();
        root?.querySelector('[data-focused]')?.scrollIntoView({ block: 'start' });
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    window.scrollTo(0, 0);
    load(true);
  });

  // A new reply was posted: refetch the thread (without jumping)
  let seenTick = composer.postedTick;
  $effect(() => {
    const t = composer.postedTick;
    if (t === untrack(() => seenTick)) return;
    seenTick = t;
    untrack(() => load(false));
  });
</script>

<div bind:this={root}>
  {#if loading}
    <p class="msg">{t('common.loading')}</p>
  {:else if error}
    <p class="msg error" role="alert">
      {error}
      <button onclick={() => load(true)}>{t('common.retry')}</button>
    </p>
  {:else}
    {#each rows as row, i (row.status.id)}
      <div class="row" class:indent={row.depth > 0} data-focused={row.focused || undefined} style:margin-left="{row.depth * 0.75}rem">
        <StatusCard
          status={row.status}
          focused={row.focused}
          rail={i < focusIdx}
          reply={i > focusIdx}
          compact={!row.focused}
        />
      </div>
    {/each}
  {/if}
</div>

{#if focused && !loading && !error}
  <div class="replybar">
    <button onclick={() => composer.show(focused)}>
      <img src={accountStore.active?.avatar} alt="" width="32" height="32" />
      {t('thread.replyTo', { name: focused.account.display_name || focused.account.username })}
    </button>
  </div>
{/if}

<style>
  .msg { text-align: center; color: var(--muted); padding: 1.5rem 1rem; margin: 0; }
  .msg.error { color: var(--danger); }
  .msg button { border: 1px solid var(--border); background: var(--bg); color: var(--text); border-radius: 0.4rem; padding: 0.3rem 0.8rem; }
  .row { scroll-margin-top: 3.5rem; }
  .row:first-child :global(article.railed) { padding-top: 1rem; }
  .row:first-child :global(article.railed)::before { display: none; }
  .replybar { position: sticky; bottom: 0; z-index: 3; padding: 0.6rem 1rem calc(0.7rem + env(safe-area-inset-bottom)); background: var(--bg); border-top: 1px solid var(--border); }
  .replybar button { display: flex; align-items: center; gap: 0.6rem; width: 100%; min-height: 3rem; padding: 0 0.5rem; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--muted); font: inherit; text-align: left; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .replybar img { width: 2rem; height: 2rem; border-radius: var(--radius-avatar); border: var(--avatar-border); flex: none; background: var(--bg); }
</style>
