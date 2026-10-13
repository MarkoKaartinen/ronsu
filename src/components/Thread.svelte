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
  // Each indent step: the replies to the selected post are at the same left edge as the ancestors, each deeper level
  // is one step in. The lines run down from a parent's avatar (its centre: 1rem padding + the avatar radius - 1 px
  // of the line) and turn to the avatar of each reply: a vertical line in the parent's column and a short branch
  const STEP = 1.75;
  const avatarRadius = (depth: number) => (depth === 1 ? 18 : 15);
  /** The column of the depth `level` post's avatar, relative to a row of depth `depth` */
  const column = (level: number, depth: number) => `calc(${(level - depth) * STEP}rem + 1rem + ${avatarRadius(level) - 1}px)`;
  /** The branch ends at the reply's avatar: the padding above it (0.9rem) and its radius */
  const branchY = (depth: number) => `calc(0.9rem + ${avatarRadius(depth) - 1}px)`;
  /** The corner is as tall as the way to the branch's line, and ends with it */
  const elbowH = (depth: number) => `calc(0.9rem + ${avatarRadius(depth) + 1}px)`;
  /** The branch is as long as the way from the parent's column to the avatar's edge (1rem) */
  const branchW = (depth: number) => `calc(${STEP}rem - ${avatarRadius(depth - 1) - 1}px)`;

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
      <div class="row" class:indent={row.depth > 0} class:discussion={row.depth === 1 && i > focusIdx + 1} data-focused={row.focused || undefined} style:margin-left="{Math.max(row.depth - 1, 0) * STEP}rem">
        {#each row.through as through, k}
          <!-- The parent's own column is drawn with its branch below -->
          {#if through && !(row.elbow && k === row.depth - 2)}<span class="guide" style:left={column(k + 1, row.depth)}></span>{/if}
        {/each}
        {#if row.elbow}
          {@const parent = column(row.depth - 1, row.depth)}
          {#if row.through[row.depth - 2]}
            <span class="guide" style:left={parent}></span>
            <span class="branch" style:left={parent} style:top={branchY(row.depth)} style:width={branchW(row.depth)}></span>
          {:else}
            <span class="elbow" style:left={parent} style:height={elbowH(row.depth)} style:width={branchW(row.depth)}></span>
          {/if}
        {/if}
        <StatusCard
          status={row.status}
          focused={row.focused}
          rail={i < focusIdx}
          reply={i > focusIdx}
          small={row.depth > 1}
          chain={row.hasChild}
          replyTo={row.replyTo}
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
  .row { position: relative; scroll-margin-top: calc(3.5rem + var(--sticky-top, 0px)); }
  /* The reply bar's top border closes the thread: the last post needs no divider of its own */
  /* Each reply to the selected post starts a discussion of its own: a full-width line sets it apart from the one above
     (which then needs no indented divider of its own) */
  .row.discussion { border-top: 1px solid var(--border); }
  .row:has(+ .discussion) :global(article.reply .body) { border-bottom: 0; }
  .row:last-child :global(article.reply .body) { border-bottom: 0; }
  .guide { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--border); }
  /* The line of the parent's avatar turns to the reply's avatar: a branch (the line goes on below) or a corner (it ends here) */
  .branch { position: absolute; height: 2px; background: var(--border); }
  .elbow { position: absolute; top: 0; box-sizing: border-box; border-left: 2px solid var(--border); border-bottom: 2px solid var(--border); border-bottom-left-radius: 0.5rem; }
  .row:first-child :global(article.railed) { padding-top: 1rem; }
  .row:first-child :global(article.railed)::before { display: none; }
  .replybar { position: sticky; bottom: 0; z-index: 3; padding: 0.6rem 1rem calc(0.7rem + env(safe-area-inset-bottom)); background: var(--bg); border-top: 1px solid var(--border); }
  .replybar button { display: flex; align-items: center; gap: 0.6rem; width: 100%; min-height: 3rem; padding: 0 0.5rem; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--muted); font: inherit; text-align: left; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .replybar img { width: 2rem; height: 2rem; border-radius: var(--radius-avatar); border: var(--avatar-border); flex: none; background: var(--bg); }
</style>
