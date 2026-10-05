<script lang="ts">
  import Bell from '@lucide/svelte/icons/bell';
  import House from '@lucide/svelte/icons/house';
  import SquarePen from '@lucide/svelte/icons/square-pen';
  import { onMount } from 'svelte';
  import { router } from '../lib/router.svelte';
  import { composer } from '../lib/stores/composer.svelte';
  import { t } from '../lib/stores/i18n.svelte';

  let { current }: { current: 'home' | 'notifications' } = $props();

  // Out of the way while reading: hides when scrolling down, comes back when scrolling up (and at the top)
  let hidden = $state(false);
  let lastY = 0;

  onMount(() => {
    lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 80 || y < lastY - 6) hidden = false;
      else if (y > lastY + 6) hidden = true;
      lastY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  });
</script>

<nav class="bar" class:hidden aria-label={t('nav.main')}>
  <button class:on={current === 'home'} aria-current={current === 'home' ? 'page' : undefined} onclick={() => router.openTab('home')}>
    <House size={20} aria-hidden="true" />
    <span>{t('nav.home')}</span>
  </button>
  <button class="compose" onclick={() => composer.show()} aria-label={t('nav.newPost')} title={t('nav.newPost')}>
    <SquarePen size={20} aria-hidden="true" />
  </button>
  <button class:on={current === 'notifications'} aria-current={current === 'notifications' ? 'page' : undefined} onclick={() => router.openTab('notifications')}>
    <Bell size={20} aria-hidden="true" />
    <span>{t('nav.notifications')}</span>
  </button>
</nav>

<style>
  .bar {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 5; max-width: 40rem; margin: 0 auto;
    display: flex; align-items: center; justify-content: space-around;
    padding: 0.2rem 0.5rem calc(0.2rem + env(safe-area-inset-bottom));
    background: var(--header); border-top: 1px solid var(--border);
    transition: transform 0.2s ease;
  }
  .bar.hidden { transform: translateY(100%); }
  button { display: flex; flex-direction: column; align-items: center; gap: 0.1rem; flex: 1; min-height: 2.5rem; padding: 0.1rem 0; border: 0; background: none; color: var(--muted); font-size: 0.7rem; font-weight: 600; }
  button.on { color: var(--accent); }
  button.compose { flex: none; width: 2.75rem; height: 2.75rem; min-height: 0; margin: 0 0.5rem; justify-content: center; border-radius: var(--radius-avatar); background: var(--accent); color: var(--on-accent); box-shadow: 0 2px 8px rgb(0 0 0 / 0.3); }
</style>
