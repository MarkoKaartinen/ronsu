<script lang="ts">
  import { onDestroy, onMount, setContext, tick } from 'svelte';
  import type { MastodonClient } from '../lib/api/client';
  import { compareIds } from '../lib/api/markers';
  import { pickTopId } from '../lib/feedLogic';
  import { FeedStore } from '../lib/stores/feed.svelte';
  import Bookmark from '@lucide/svelte/icons/bookmark';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import { t } from '../lib/stores/i18n.svelte';
  import StatusCard from './StatusCard.svelte';

  // active=false: the Feed stays mounted, hidden (while a thread is open), but does not record the reading position
  let { client, storageKey, active = true }: { client: MastodonClient; storageKey: string; active?: boolean } = $props();

  // The component is recreated on an account switch ({#key}), so the client is constant
  // svelte-ignore state_referenced_locally
  const feed = new FeedStore(client, `read-marker|${storageKey}`);
  // The action buttons (favorite, boost, bookmark) use the same client
  // svelte-ignore state_referenced_locally
  setContext('mastodon-client', client);

  let listEl: HTMLElement | undefined = $state();
  let barEl: HTMLElement | undefined = $state();
  let sentinel: HTMLElement | undefined = $state();
  let raf = 0;

  /** The topmost post on screen is the reading position (oldest-first mode only). */
  function scanRead() {
    raf = 0;
    if (!active || !listEl || document.visibilityState !== 'visible') return;
    const rects = [...listEl.querySelectorAll<HTMLElement>('article[data-id]')].map((el) => ({
      id: el.dataset.id!,
      bottom: el.getBoundingClientRect().bottom,
    }));
    const id = pickTopId(rects, barEl?.getBoundingClientRect().bottom ?? 0);
    if (id) feed.reportRead(id);
  }

  /**
   * Load older posts to the top of the list and keep the current content at exactly the same place on
   * screen (Safari has no scroll anchoring). The position of the first post is measured, not the whole
   * page height, so the button disappearing or similar does not matter.
   */
  async function loadOlder() {
    const anchor = listEl?.querySelector<HTMLElement>('article[data-id]');
    const before = anchor?.getBoundingClientRect().top;
    await feed.loadOlder();
    await tick();
    if (anchor?.isConnected && before !== undefined) {
      window.scrollBy(0, anchor.getBoundingClientRect().top - before);
    }
  }

  function scheduleScan() {
    if (!raf) raf = requestAnimationFrame(scanRead);
  }

  function onPageHide() {
    feed.flush(true);
  }

  function onVisibility() {
    if (document.visibilityState === 'hidden') feed.flush(true);
    else feed.resume();
  }

  /**
   * An installed app on a phone is often resumed from the background without being reloaded, and not every
   * browser sends `visibilitychange` for that. So the position is also checked when the page is shown again
   * (`pageshow`), gets focus, or the connection is back, and every minute while the app is in front.
   */
  function onWake() {
    if (active && document.visibilityState === 'visible') feed.resume();
  }
  const WAKE_EVENTS = ['pageshow', 'focus', 'online'] as const;
  let poll: ReturnType<typeof setInterval> | undefined;

  let observer: IntersectionObserver | undefined;

  onMount(() => {
    feed.start();
    window.addEventListener('scroll', scheduleScan, { passive: true });
    window.addEventListener('resize', scheduleScan);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    for (const name of WAKE_EVENTS) window.addEventListener(name, onWake);
    poll = setInterval(onWake, 60_000);
  });

  // Infinite scrolling: when the sentinel at the bottom becomes visible, fetch the next page
  $effect(() => {
    observer?.disconnect();
    if (!sentinel) return;
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) feed.loadMore();
      },
      { rootMargin: '600px' },
    );
    observer.observe(sentinel);
    return () => observer?.disconnect();
  });

  // New posts were rendered: check which ones have been seen
  $effect(() => {
    feed.items.length;
    queueMicrotask(scheduleScan);
  });

  onDestroy(() => {
    window.removeEventListener('scroll', scheduleScan);
    window.removeEventListener('resize', scheduleScan);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
    for (const name of WAKE_EVENTS) window.removeEventListener(name, onWake);
    clearInterval(poll);
    if (raf) cancelAnimationFrame(raf);
    observer?.disconnect();
    feed.destroy();
  });

  /** Newest-first mode: the first already-read post (the divider) */
  const dividerId = $derived.by(() => {
    if (feed.order !== 'newest-first' || !feed.marker) return null;
    const m = feed.marker;
    return feed.items.find((s) => compareIds(s.id, m) <= 0)?.id ?? null;
  });

  /**
   * Reading progress of the loaded list (oldest first): posts after the reading position are unread.
   * When not everything is loaded the count is a lower bound ("+").
   */
  const progress = $derived.by(() => {
    if (feed.order !== 'oldest-first' || !feed.marker || !feed.items.length) return null;
    const m = feed.marker;
    const idx = feed.items.findIndex((s) => compareIds(s.id, m) > 0);
    const unread = idx === -1 ? 0 : feed.items.length - idx;
    return { unread, more: !feed.endReached, share: (feed.items.length - unread) / feed.items.length };
  });
</script>

<div class="bar" bind:this={barEl}>
  <div class="row">
    <span class="status">
      {#if progress}
        <strong>{t('feed.unread', { count: `${progress.unread}${progress.more ? '+' : ''}` })}</strong>
      {:else if feed.order === 'newest-first'}
        {t('feed.hintNewest')}
      {:else}
        {t('feed.hintSaved')}
      {/if}
    </span>
    <label class="order">
      <span class="sr">{t('feed.order')}</span>
      <select value={feed.order} onchange={(e) => feed.setOrder(e.currentTarget.value as 'oldest-first' | 'newest-first')}>
        <option value="oldest-first">{t('feed.oldestFirst')}</option>
        <option value="newest-first">{t('feed.newestFirst')}</option>
      </select>
      <ChevronDown size={16} aria-hidden="true" />
    </label>
  </div>
  {#if progress}
    <div class="track" role="presentation"><div class="fill" style:width="{Math.round(progress.share * 100)}%"></div></div>
  {/if}
</div>

{#if feed.remoteAhead && feed.order === 'oldest-first'}
  <div class="banner" role="status">
    <span>{t('feed.remoteAhead')}</span>
    <button onclick={() => feed.jumpToRemote()}>{t('feed.jump')}</button>
    <button class="ghost" onclick={() => feed.dismissRemote()}>{t('feed.notNow')}</button>
  </div>
{/if}

{#if feed.order === 'oldest-first' && feed.items.length && !feed.olderEnd}
  <div class="older">
    <button onclick={loadOlder} disabled={feed.olderLoading}>
      {feed.olderLoading ? t('common.loading') : t('feed.loadOlder')}
    </button>
  </div>
{/if}

{#if feed.markerError}
  <p class="msg error" role="alert">{feed.markerError}</p>
{/if}

<div bind:this={listEl} class="list">
  {#each feed.items as status (status.id)}
    {#if status.id === dividerId}
      <div class="divider"><span class="line"></span><Bookmark size={14} fill="currentColor" aria-hidden="true" />{t('feed.readUpTo')}<span class="line"></span></div>
    {/if}
    {#if status.id === feed.restoredId}
      <div class="divider"><span class="line"></span><Bookmark size={14} fill="currentColor" aria-hidden="true" />{t('feed.leftOffHere')}<span class="line"></span></div>
    {/if}
    <StatusCard {status} />
  {/each}
</div>

{#if feed.error}
  <p class="msg error" role="alert">
    {feed.error}
    <button onclick={() => (feed.items.length ? feed.loadMore() : feed.start())}>{t('common.retry')}</button>
  </p>
{/if}

{#if feed.loading}
  <p class="msg">{t('common.loading')}</p>
{:else if feed.endReached}
  <p class="msg">
    {feed.items.length ? t('feed.caughtUp') : t('feed.empty')}
    {#if feed.order === 'oldest-first'}
      <button onclick={() => feed.checkForNew()}>{t('feed.checkNew')}</button>
    {/if}
  </p>
{/if}

<div bind:this={sentinel} class="sentinel" aria-hidden="true"></div>

<style>
  .bar { position: sticky; top: 0; z-index: 2; background: var(--bg); border-bottom: 1px solid var(--border); padding: 0.4rem 1rem 0.8rem; }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; font-size: 0.9rem; color: var(--muted); min-height: 2.75rem; }
  .status strong { color: var(--text); }
  .order { position: relative; display: inline-flex; align-items: center; color: var(--accent); margin-right: -0.5rem; }
  .order select { appearance: none; min-height: 2.75rem; padding: 0 1.6rem 0 0.5rem; border: 0; background: none; color: inherit; font: inherit; font-weight: 600; cursor: pointer; }
  .order :global(svg) { position: absolute; right: 0.3rem; pointer-events: none; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  .track { height: 4px; border-radius: 2px; background: var(--surface); }
  .fill { height: 100%; border-radius: 2px; background: var(--accent); }
  .banner { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; padding: 0.6rem 1rem; background: var(--surface); border-bottom: 1px solid var(--border); }
  .banner span { flex: 1; min-width: 12rem; }
  .banner button, .msg button { border: 1px solid var(--border); background: var(--bg); color: var(--text); border-radius: 0.4rem; padding: 0.3rem 0.8rem; }
  .banner .ghost { background: none; }
  .divider { display: flex; align-items: center; gap: 0.6rem; color: var(--marker); font-size: 0.85rem; font-weight: 600; padding: 0.6rem 1rem; background: var(--surface); border-bottom: 1px solid var(--border); }
  .divider .line { flex: 1; height: 1px; background: color-mix(in srgb, var(--marker) 40%, transparent); }
  .msg { text-align: center; color: var(--muted); padding: 1rem; margin: 0; }
  .msg.error { color: var(--danger); }
  .sentinel { height: 1px; }
  .list { overflow-anchor: none; }
  .older { text-align: center; padding: 0.6rem; border-bottom: 1px solid var(--border); }
  .older button { border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: 0.5rem; padding: 0.5rem 1.2rem; }
</style>
