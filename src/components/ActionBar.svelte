<script lang="ts">
  import Bookmark from '@lucide/svelte/icons/bookmark';
  import Ellipsis from '@lucide/svelte/icons/ellipsis';
  import Heart from '@lucide/svelte/icons/heart';
  import MessageCircle from '@lucide/svelte/icons/message-circle';
  import Quote from '@lucide/svelte/icons/quote';
  import Repeat2 from '@lucide/svelte/icons/repeat-2';
  import { getContext } from 'svelte';
  import { blockDomain, getRelationship, moderationEndpoint, muteAccount, muteConversation, type Moderation } from '../lib/api/accounts';
  import { canQuote, canReblog, isOn, quoteSupported, toggle, type ActionKind } from '../lib/actions';
  import { ApiError, type MastodonClient } from '../lib/api/client';
  import { deleteStatus } from '../lib/api/statuses';
  import type { Relationship, Status } from '../lib/api/types';
  import { accountStore } from '../lib/stores/accounts.svelte';
  import { canMuteConversation, remoteDomain } from '../lib/moderation';
  import { composer } from '../lib/stores/composer.svelte';
  import { deletedIds } from '../lib/stores/deleted.svelte';
  import { router } from '../lib/router.svelte';
  import { t } from '../lib/stores/i18n.svelte';
  import { toast } from '../lib/stores/toast.svelte';
  import { safeHttpUrl } from '../lib/url';
  import ModerationDialog, { type Ask } from './ModerationDialog.svelte';

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

  /** Room the menu needs below its button (up to eight rows and the lines between them), and the bottom bar that covers the page's lower edge */
  const MENU_SPACE_PX = 360;
  const BOTTOM_BAR_PX = 72;

  let menuOpen = $state(false);
  /** Open upwards when the menu would run under the bottom bar */
  let menuUp = $state(false);
  /** The question being asked before a mute, a block or a domain block */
  let ask = $state<Ask | null>(null);
  let rel = $state<Relationship | null>(null);
  const isSelf = $derived(status.account.id === accountStore.active?.accountId);
  const link = $derived(safeHttpUrl(status.url));
  const domain = $derived(remoteDomain(status.account.acct));
  const canMuteThread = $derived(canMuteConversation(status, accountStore.active?.accountId));
  const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

  /** The relationship tells whether the menu offers mute or unmute, block or unblock */
  async function toggleMenu(e: MouseEvent) {
    menuOpen = !menuOpen;
    menuUp = (e.currentTarget as HTMLElement).getBoundingClientRect().bottom + MENU_SPACE_PX > window.innerHeight - BOTTOM_BAR_PX;
    if (!menuOpen || isSelf) return;
    try {
      rel = await getRelationship(client, status.account.id);
    } catch {
      rel = null;
    }
  }

  async function copyLink() {
    menuOpen = false;
    try {
      await navigator.clipboard.writeText(link!);
      toast.show(t('menu.copied'), 'info');
    } catch (e) {
      toast.show(t('action.failed', { message: errorText(e) }));
    }
  }

  /** Runs a moderation request; a 403 means the login lacks the scope */
  async function moderate(request: () => Promise<unknown>) {
    menuOpen = false;
    ask = null;
    try {
      await request();
    } catch (e) {
      toast.show(e instanceof ApiError && e.status === 403 ? t('menu.reauthModeration') : t('menu.moderationFailed', { message: errorText(e) }));
    }
  }

  const askFirst = (next: Ask) => {
    menuOpen = false;
    ask = next;
  };
  const onModerate = (action: Moderation) =>
    moderate(async () => (rel = await client.post<Relationship>(moderationEndpoint(status.account.id, action))));
  const onMute = (duration: number, notifications: boolean) =>
    moderate(async () => (rel = await muteAccount(client, status.account.id, duration, notifications)));
  const onDomain = (on: boolean) =>
    moderate(async () => {
      await blockDomain(client, domain!, on);
      if (rel) rel.domain_blocking = on;
    });
  /** The post goes from every view; if it is the open thread's own post, back out of it */
  async function onDelete() {
    ask = null;
    try {
      await deleteStatus(client, status.id);
    } catch (e) {
      toast.show(t('action.failed', { message: errorText(e) }));
      return;
    }
    deletedIds.add(status.id);
    if (router.route.name === 'thread' && router.route.id === status.id) router.back();
  }
  const onThread = () =>
    moderate(async () => {
      status.muted = (await muteConversation(client, status.id, !status.muted)).muted;
    });
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (menuOpen = false)} onclick={(e) => menuOpen && !(e.target as Element).closest('.menu') && (menuOpen = false)} />

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

  <div class="menu">
    <button aria-label={t('menu.more')} title={t('menu.more')} aria-haspopup="menu" aria-expanded={menuOpen} onclick={toggleMenu}>
      <Ellipsis size={large ? 22 : 20} aria-hidden="true" />
    </button>
    {#if menuOpen}
      <ul role="menu" class:up={menuUp}>
        {#if link}
          <li role="none"><a role="menuitem" href={link} target="_blank" rel="noopener noreferrer" onclick={() => (menuOpen = false)}>{t('menu.openOriginal')}</a></li>
          <li role="none"><button role="menuitem" onclick={copyLink}>{t('menu.copyLink')}</button></li>
        {/if}
        {#if canMuteThread}
          <li role="separator"></li>
          <li role="none"><button role="menuitem" onclick={onThread}>{t(status.muted ? 'menu.unmuteConversation' : 'menu.muteConversation')}</button></li>
        {/if}
        {#if isSelf}
          <li role="separator"></li>
          <li role="none"><button role="menuitem" class="danger" onclick={() => askFirst({ kind: 'delete' })}>{t('menu.delete')}</button></li>
        {:else}
          <!-- The rows are there from the start (disabled until the relationship is known) so the menu does not grow after it opens -->
          <li role="separator"></li>
          <li role="none"><button role="menuitem" disabled={!rel} onclick={() => (rel?.muting ? onModerate('unmute') : askFirst({ kind: 'mute', name: status.account.acct }))}>{t(rel?.muting ? 'menu.unmute' : 'menu.mute', { name: status.account.acct })}</button></li>
          <li role="none"><button role="menuitem" disabled={!rel} onclick={() => (rel?.blocking ? onModerate('unblock') : askFirst({ kind: 'block', name: status.account.acct }))}>{t(rel?.blocking ? 'menu.unblock' : 'menu.block', { name: status.account.acct })}</button></li>
          {#if domain}
            <li role="separator"></li>
            <li role="none">
              <button role="menuitem" disabled={!rel} onclick={() => (rel?.domain_blocking ? onDomain(false) : askFirst({ kind: 'domain', domain: domain! }))}>
                {t(rel?.domain_blocking ? 'menu.unblockDomain' : 'menu.blockDomain', { domain })}
              </button>
            </li>
          {/if}
        {/if}
      </ul>
    {/if}
  </div>
</div>

{#if ask}
  <ModerationDialog {ask} {onMute} onConfirm={() => (ask?.kind === 'delete' ? onDelete() : ask?.kind === 'domain' ? onDomain(true) : onModerate('block'))} onCancel={() => (ask = null)} />
{/if}

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
  .menu { position: relative; }
  .menu ul { position: absolute; right: 0; top: 100%; z-index: 5; width: max-content; min-width: 14rem; max-width: calc(100vw - 2rem); margin: 0; padding: 0.3rem; list-style: none; border-radius: 0.9rem; background: var(--surface); border: 1px solid color-mix(in srgb, var(--text) 28%, var(--border)); box-shadow: 0 6px 20px rgb(0 0 0 / 0.35); color: var(--text); }
  .menu li button, .menu li a { display: block; width: 100%; padding: 0.75rem 0.8rem; border-radius: 0.6rem; color: var(--text); font: inherit; font-size: 1rem; line-height: 1.3; text-align: left; text-decoration: none; overflow-wrap: anywhere; box-sizing: border-box; }
  .menu ul.up { top: auto; bottom: 100%; }
  .menu li[role='separator'] { height: 1px; margin: 0.3rem 0.4rem; background: var(--border); }
  .menu li button.danger { color: var(--danger); }
  .menu li a:hover, .menu li button:hover:not(:disabled) { background: var(--bg); }
  button:disabled { opacity: 0.4; cursor: default; }
</style>
