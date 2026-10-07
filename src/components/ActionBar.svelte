<script lang="ts">
  import Bookmark from '@lucide/svelte/icons/bookmark';
  import Heart from '@lucide/svelte/icons/heart';
  import MessageCircle from '@lucide/svelte/icons/message-circle';
  import Quote from '@lucide/svelte/icons/quote';
  import Repeat2 from '@lucide/svelte/icons/repeat-2';
  import { getContext } from 'svelte';
  import { canQuote, canReblog, isOn, quoteSupported, toggle, type ActionKind } from '../lib/actions';
  import type { MastodonClient } from '../lib/api/client';
  import type { Status } from '../lib/api/types';
  import { composer } from '../lib/stores/composer.svelte';
  import { t } from '../lib/stores/i18n.svelte';
  import { toast } from '../lib/stores/toast.svelte';

  /** The original post (status.reblog for a boost) the actions apply to */
  let { status, large = false }: { status: Status; large?: boolean } = $props();

  const client = getContext<MastodonClient>('mastodon-client');

  // Prevent a double tap while the previous request is still pending
  let busy = $state<Partial<Record<ActionKind, boolean>>>({});

  async function act(kind: ActionKind) {
    if (busy[kind]) return;
    busy[kind] = true;
    try {
      await toggle(client, status, kind);
    } catch (e) {
      toast.show(t('action.failed', { message: e instanceof Error ? e.message : String(e) }));
    } finally {
      busy[kind] = false;
    }
  }
</script>

<div class="actions" class:large>
  <button aria-label={t('action.reply')} title={t('action.reply')} onclick={() => composer.show(status)}>
    <MessageCircle size={large ? 22 : 20} aria-hidden="true" />
    {#if !large}<span>{status.replies_count}</span>{/if}
  </button>

  <button
    class="reblog"
    class:on={isOn(status, 'reblog')}
    aria-pressed={isOn(status, 'reblog')}
    disabled={!canReblog(status) && !isOn(status, 'reblog')}
    aria-label={t('action.boost')}
    title={!canReblog(status) && !isOn(status, 'reblog') ? t('action.cannotBoost') : isOn(status, 'reblog') ? t('action.unboost') : t('action.boost')}
    onclick={() => act('reblog')}
  >
    <Repeat2 size={large ? 22 : 20} aria-hidden="true" />
    {#if !large}<span>{status.reblogs_count}</span>{/if}
  </button>

  {#if quoteSupported(status)}
    <button
      class="quote"
      disabled={!canQuote(status)}
      aria-label={t('action.quote')}
      title={canQuote(status) ? t('action.quote') : t('action.cannotQuote')}
      onclick={() => composer.showQuote(status)}
    >
      <Quote size={large ? 22 : 20} aria-hidden="true" />
      {#if !large}<span>{status.quotes_count ?? 0}</span>{/if}
    </button>
  {/if}

  <button
    class="fav"
    class:on={isOn(status, 'favourite')}
    aria-pressed={isOn(status, 'favourite')}
    aria-label={t('action.favorite')}
    title={isOn(status, 'favourite') ? t('action.unfavorite') : t('action.favorite')}
    onclick={() => act('favourite')}
  >
    <Heart size={large ? 22 : 20} fill={isOn(status, 'favourite') ? 'currentColor' : 'none'} aria-hidden="true" />
    {#if !large}<span>{status.favourites_count}</span>{/if}
  </button>

  <button
    class="mark"
    class:on={isOn(status, 'bookmark')}
    aria-pressed={isOn(status, 'bookmark')}
    aria-label={t('action.bookmark')}
    title={isOn(status, 'bookmark') ? t('action.removeBookmark') : t('action.bookmark')}
    onclick={() => act('bookmark')}
  >
    <Bookmark size={large ? 22 : 20} fill={isOn(status, 'bookmark') ? 'currentColor' : 'none'} aria-hidden="true" />
  </button>
</div>

<style>
  /* The buttons spread over the full width; the -0.7rem margin aligns the icons with the text's left edge */
  .actions { display: flex; justify-content: space-between; align-items: center; margin: 0.15rem -0.7rem 0; color: var(--muted); font-size: 0.9rem; }
  .actions.large { justify-content: space-around; margin: 0.2rem 0 0; }
  button {
    display: inline-flex; gap: 0.35rem; align-items: center; justify-content: center; min-height: 2.75rem; min-width: 2.75rem;
    padding: 0 0.7rem; border: 0; border-radius: 0.6rem;
    background: none; color: inherit;
  }
  .large button { min-height: 3rem; min-width: 3.5rem; }
  button:hover:not(:disabled) { background: var(--surface); }
  :global(.focused) button:hover:not(:disabled) { background: var(--bg); }
  button.reblog.on { color: var(--boost); }
  button.fav.on { color: var(--like); }
  button.mark.on { color: var(--accent); }
  button:disabled { opacity: 0.4; cursor: default; }
</style>
