<script lang="ts">
  import Bell from '@lucide/svelte/icons/bell';
  import House from '@lucide/svelte/icons/house';
  import Mail from '@lucide/svelte/icons/mail';
  import Menu from '@lucide/svelte/icons/menu';
  import Plus from '@lucide/svelte/icons/plus';
  import { router, type MainView, type SavedView } from '../lib/router.svelte';
  import { composer } from '../lib/stores/composer.svelte';
  import { t } from '../lib/stores/i18n.svelte';
  import { messages } from '../lib/stores/messages.svelte';
  import { unread } from '../lib/stores/unread.svelte';

  // onMenu: opens the drawer with the places that have no room on the bar
  let { current, onMenu }: { current: MainView | SavedView | 'settings'; onMenu: () => void } = $props();
</script>

<nav class="bar" aria-label={t('nav.main')}>
  <button class:on={current === 'home'} aria-current={current === 'home' ? 'page' : undefined} aria-label={t('nav.home')} title={t('nav.home')} onclick={() => router.openTab('home')}>
    <House size={24} aria-hidden="true" />
  </button>
  <button class:on={current === 'messages'} aria-current={current === 'messages' ? 'page' : undefined} aria-label={messages.hasNew ? t('nav.messagesNew') : t('nav.messages')} title={t('nav.messages')} onclick={() => router.openTab('messages')}>
    <span class="badge">
      <Mail size={24} aria-hidden="true" />
      {#if messages.hasNew}<span class="dot" aria-hidden="true"></span>{/if}
    </span>
  </button>
  <button class="compose" onclick={() => composer.show()} aria-label={t('nav.newPost')} title={t('nav.newPost')}>
    <Plus size={28} aria-hidden="true" />
  </button>
  <button class:on={current === 'notifications'} aria-current={current === 'notifications' ? 'page' : undefined} aria-label={unread.hasNew ? t('nav.notificationsNew') : t('nav.notifications')} title={t('nav.notifications')} onclick={() => router.openTab('notifications')}>
    <span class="badge">
      <Bell size={24} aria-hidden="true" />
      {#if unread.hasNew}<span class="dot" aria-hidden="true"></span>{/if}
    </span>
  </button>
  <button aria-label={t('nav.menu')} title={t('nav.menu')} onclick={onMenu}>
    <Menu size={24} aria-hidden="true" />
  </button>
</nav>

<style>
  /* Always in place, like the top bar */
  .bar {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 5; max-width: 40rem; margin: 0 auto;
    display: flex; align-items: center; justify-content: space-around;
    padding: 0.1rem 0.5rem calc(0.1rem + var(--inset-bottom));
    background: var(--header); border-top: 1px solid var(--border);
  }
  button { display: flex; align-items: center; justify-content: center; flex: 1; min-height: 2.5rem; padding: 0; border: 0; background: none; color: var(--muted); }
  button.on { color: var(--accent); }
  .badge { position: relative; display: inline-flex; }
  /* A red ball on the icon: something has not been seen */
  .dot { position: absolute; top: -0.15rem; right: -0.3rem; width: 0.65rem; height: 0.65rem; border-radius: 50%; background: var(--danger); border: 2px solid var(--header); box-sizing: content-box; }
  /* Only the plus, without a colour of its own */
  button.compose { color: var(--text); }
</style>
