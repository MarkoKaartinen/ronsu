<script lang="ts">
  import { onMount, setContext, untrack } from 'svelte';
  import type { MastodonClient } from '../lib/api/client';
  import { followTag, getTag, getTagTimeline } from '../lib/api/tags';
  import type { Status, Tag } from '../lib/api/types';
  import { t } from '../lib/stores/i18n.svelte';
  import { toast } from '../lib/stores/toast.svelte';
  import StatusCard from './StatusCard.svelte';

  // tag: the name of the hashtag, without the "#"
  let { client, tag }: { client: MastodonClient; tag: string } = $props();

  // The action buttons (ActionBar) of the post list get the client from the context
  // svelte-ignore state_referenced_locally
  setContext('mastodon-client', client);

  /** The hashtag as the server knows it; without it there is no follow button, but the posts still show */
  let info = $state<Tag | null>(null);
  let statuses = $state<Status[]>([]);
  let error = $state('');
  let loadingMore = $state(false);
  let end = $state(false);
  let busy = $state(false);
  let sentinel: HTMLElement | undefined = $state();

  const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

  async function loadMore() {
    if (loadingMore || end || error) return;
    loadingMore = true;
    try {
      const page = await getTagTimeline(client, tag, statuses[statuses.length - 1]?.id);
      // Never list the same post twice (a duplicate key would crash the keyed list)
      const known = new Set(statuses.map((s) => s.id));
      const fresh = page.items.filter((s) => !known.has(s.id));
      if (fresh.length === 0) end = true;
      else statuses.push(...fresh);
    } catch (e) {
      error = errorText(e);
    } finally {
      loadingMore = false;
    }
  }

  function retry() {
    error = '';
    void loadMore();
  }

  async function onFollow() {
    if (!info || busy) return;
    busy = true;
    try {
      info = await followTag(client, tag, !info.following);
    } catch (e) {
      toast.show(t('tag.followFailed', { message: errorText(e) }));
    } finally {
      busy = false;
    }
  }

  onMount(() => {
    window.scrollTo(0, 0);
    getTag(client, tag).then(
      (found) => (info = found),
      () => {},
    );
  });

  // Infinite scrolling: when the sentinel at the bottom becomes visible, fetch the next page
  $effect(() => {
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) untrack(loadMore);
      },
      { rootMargin: '600px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  });
</script>

<section class="head">
  <h2>#{info?.name ?? tag}</h2>
  {#if info}
    <button class="follow" class:secondary={info.following} disabled={busy} onclick={onFollow}>
      {info.following ? t('tag.unfollow') : t('tag.follow')}
    </button>
  {/if}
</section>

<div class="list">
  {#each statuses as status (status.id)}
    <StatusCard {status} filterContext="public" />
  {/each}
</div>

{#if error}
  <p class="msg error" role="alert">
    {error}
    <button onclick={retry}>{t('common.retry')}</button>
  </p>
{:else if loadingMore}
  <p class="msg">{t('common.loading')}</p>
{:else if end}
  <p class="msg">{statuses.length ? t('profile.noMore') : t('tag.empty')}</p>
{/if}
<div bind:this={sentinel} class="sentinel" aria-hidden="true"></div>

<style>
  .head { display: flex; gap: 0.8rem; align-items: center; justify-content: space-between; padding: 1rem; border-bottom: 1px solid var(--border); }
  h2 { margin: 0; font-size: 1.5rem; letter-spacing: -0.01em; overflow-wrap: anywhere; min-width: 0; }
  .follow { flex: none; min-height: 2.75rem; padding: 0 1.4rem; border: 0; border-radius: 999px; background: var(--accent); color: var(--on-accent); font-weight: 700; font-size: 1rem; }
  .follow.secondary { background: var(--surface); border: 1px solid var(--border); color: var(--text); }
  .follow:disabled { opacity: 0.6; cursor: default; }
  .msg { text-align: center; color: var(--muted); padding: 1.5rem 1rem; margin: 0; }
  .msg.error { color: var(--danger); }
  .msg button { border: 1px solid var(--border); background: var(--bg); color: var(--text); border-radius: 0.4rem; padding: 0.3rem 0.8rem; }
  .sentinel { height: 1px; }
</style>
