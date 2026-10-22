<script lang="ts">
  import { onMount } from 'svelte';
  import Bell from '@lucide/svelte/icons/bell';
  import Bookmark from '@lucide/svelte/icons/bookmark';
  import Heart from '@lucide/svelte/icons/heart';
  import House from '@lucide/svelte/icons/house';
  import Mail from '@lucide/svelte/icons/mail';
  import Plus from '@lucide/svelte/icons/plus';
  import Settings from '@lucide/svelte/icons/settings';
  import { router, type MainView, type SavedView } from '../lib/router.svelte';
  import { accountStore } from '../lib/stores/accounts.svelte';
  import { composer } from '../lib/stores/composer.svelte';
  import { t } from '../lib/stores/i18n.svelte';
  import { messages } from '../lib/stores/messages.svelte';
  import { unread } from '../lib/stores/unread.svelte';

  // onSettings: the account and settings page, which is a page of its own
  let { onClose, onSettings }: { onClose: () => void; onSettings: () => void } = $props();

  const account = $derived(accountStore.active);
  let panel: HTMLElement;

  /** Every choice closes the drawer first: it is only a way to get somewhere */
  const go = (action: () => void) => () => {
    onClose();
    action();
  };

  onMount(() => panel.querySelector<HTMLElement>('button')?.focus());
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onClose()} />

<div class="drawer">
  <button class="backdrop" onclick={onClose} aria-label={t('common.close')} tabindex="-1"></button>
  <div class="panel" bind:this={panel} role="dialog" aria-modal="true" aria-label={t('nav.menu')}>
    <button class="account" onclick={go(onSettings)} aria-label={t('nav.account', { acct: account?.acct ?? '' })}>
      <span class="avatar">
        {#if account?.avatar}
          <img src={account.avatar} alt="" width="48" height="48" />
        {:else}
          {(account?.displayName ?? '').charAt(0).toUpperCase() || '?'}
        {/if}
      </span>
      <span class="who">
        <strong>{account?.displayName || account?.acct}</strong>
        <small>@{account?.acct}</small>
      </span>
    </button>

    <button class="post" onclick={go(() => composer.show())}>
      <Plus size={22} aria-hidden="true" />{t('nav.newPost')}
    </button>

    <ul>
      <li>
        <button onclick={go(() => router.openTab('home' satisfies MainView))}><House size={24} aria-hidden="true" />{t('nav.home')}</button>
      </li>
      <li>
        <button onclick={go(() => router.openTab('notifications' satisfies MainView))} aria-label={unread.hasNew ? t('nav.notificationsNew') : t('nav.notifications')}>
          <span class="icon"><Bell size={24} aria-hidden="true" />{#if unread.hasNew}<span class="dot" aria-hidden="true"></span>{/if}</span>{t('nav.notifications')}
        </button>
      </li>
      <li>
        <button onclick={go(() => router.openTab('messages' satisfies MainView))} aria-label={messages.hasNew ? t('nav.messagesNew') : t('nav.messages')}>
          <span class="icon"><Mail size={24} aria-hidden="true" />{#if messages.hasNew}<span class="dot" aria-hidden="true"></span>{/if}</span>{t('nav.messages')}
        </button>
      </li>
      <li>
        <button onclick={go(() => router.openSaved('favourites' satisfies SavedView))}><Heart size={24} aria-hidden="true" />{t('nav.favourites')}</button>
      </li>
      <li>
        <button onclick={go(() => router.openSaved('bookmarks' satisfies SavedView))}><Bookmark size={24} aria-hidden="true" />{t('nav.bookmarks')}</button>
      </li>
      <li>
        <button onclick={go(onSettings)}><Settings size={24} aria-hidden="true" />{t('nav.settings')}</button>
      </li>
    </ul>
  </div>
</div>

<style>
  .drawer { position: fixed; inset: 0; z-index: 15; display: flex; justify-content: flex-end; }
  .backdrop { position: absolute; inset: 0; border: 0; background: rgb(0 0 0 / 0.5); animation: fade 0.18s ease-out; }
  /* From the right, where the menu button is */
  .panel {
    position: relative; width: min(20rem, 85vw); height: 100%; box-sizing: border-box; overflow-y: auto; overscroll-behavior: contain;
    display: flex; flex-direction: column; gap: 0.9rem; padding: 1.2rem 0.8rem calc(1.2rem + env(safe-area-inset-bottom));
    background: var(--bg); border-left: 1px solid var(--border); animation: slide 0.2s ease-out;
  }
  @keyframes slide { from { transform: translateX(100%); } }
  @keyframes fade { from { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .backdrop, .panel { animation: none; } }
  button { border: 0; background: none; color: var(--text); font: inherit; text-align: left; }
  .account { display: flex; align-items: center; gap: 0.8rem; padding: 0.3rem 0.4rem; min-width: 0; }
  .avatar { display: inline-flex; align-items: center; justify-content: center; flex: none; width: 3rem; height: 3rem; border-radius: var(--radius-avatar); background: var(--accent); color: var(--on-accent); font-weight: 700; overflow: hidden; }
  .avatar img { width: 100%; height: 100%; object-fit: cover; display: block; border: var(--avatar-border); border-radius: var(--radius-avatar); }
  .who { display: flex; flex-direction: column; min-width: 0; line-height: 1.3; }
  .who strong, .who small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .who small { color: var(--muted); }
  .post { display: flex; align-items: center; gap: 0.5rem; align-self: flex-start; min-height: 3rem; padding: 0 1.3rem; border-radius: 999px; background: var(--accent); color: var(--on-accent); font-weight: 700; }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  li button { display: flex; align-items: center; gap: 1rem; width: 100%; min-height: 3.25rem; padding: 0 0.5rem; border-radius: 0.7rem; font-size: 1.05rem; }
  li button:hover { background: color-mix(in srgb, var(--accent) 8%, transparent); }
  li button :global(svg) { color: var(--muted); }
  .icon { position: relative; display: inline-flex; }
  /* A red ball on the icon: something has not been seen (as on the bottom bar's) */
  .dot { position: absolute; top: -0.15rem; right: -0.3rem; width: 0.65rem; height: 0.65rem; border-radius: 50%; background: var(--danger); border: 2px solid var(--bg); box-sizing: content-box; }
</style>
