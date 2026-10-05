<script lang="ts">
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import SquarePen from '@lucide/svelte/icons/square-pen';
  import X from '@lucide/svelte/icons/x';
  import { onMount, tick } from 'svelte';
  import { finishLogin, hasOAuthCallback } from './lib/api/oauth';
  import { accountStore } from './lib/stores/accounts.svelte';
  import Login from './components/Login.svelte';
  import Compose from './components/Compose.svelte';
  import Lightbox from './components/Lightbox.svelte';
  import Feed from './components/Feed.svelte';
  import Profile from './components/Profile.svelte';
  import Thread from './components/Thread.svelte';
  import Settings from './components/Settings.svelte';
  import { fontStore } from './lib/stores/font.svelte';
  import { themeStore } from './lib/stores/theme.svelte';
  import { router } from './lib/router.svelte';
  import { composer } from './lib/stores/composer.svelte';
  import { t } from './lib/stores/i18n.svelte';
  import { toast } from './lib/stores/toast.svelte';

  let loginError = $state('');
  let adding = $state(false);
  let showSettings = $state(false);

  const threadId = $derived(router.route.name === 'thread' ? router.route.id : null);
  const profileHandle = $derived(router.route.name === 'profile' ? router.route.handle : null);
  const onHome = $derived(router.route.name === 'home');

  // Back to the home view: restore the scroll position (the Feed stayed mounted, hidden)
  let wasHome = true;
  $effect(() => {
    const isHome = onHome;
    if (isHome && !wasHome) tick().then(() => window.scrollTo(0, router.homeScrollY));
    wasHome = isHome;
  });

  $effect(() => themeStore.apply());
  $effect(() => fontStore.apply());

  onMount(async () => {
    await accountStore.load();
    if (hasOAuthCallback()) {
      try {
        await accountStore.add(await finishLogin());
        adding = false;
      } catch (err) {
        loginError = err instanceof Error ? err.message : String(err);
        adding = true;
      }
    }
  });
</script>

{#if !accountStore.ready}
  <p class="loading">{t('common.loading')}</p>
{:else if !accountStore.active || adding}
  <Login error={loginError} onCancel={accountStore.active ? () => (adding = false) : undefined} />
{:else}
  <div class="shell" class:home={onHome}>
    {#if !onHome}
      <header class="top sticky">
        <button class="icon" onclick={() => router.back()} aria-label={t('common.back')}><ArrowLeft size={22} /></button>
        <strong>{threadId ? t('thread.title') : t('profile.title')}</strong>
      </header>
    {:else}
      <header class="top">
        <div class="brand">
          <img src="/icon-192.png" alt="" width="40" height="40" />
          <strong>Ronsu</strong>
        </div>
        <div class="right">
          <button class="avatar" onclick={() => (showSettings = true)} aria-label={t('nav.account', { acct: accountStore.active.acct })} title={t('settings.title')}>
            {#if accountStore.active.avatar}
              <img src={accountStore.active.avatar} alt="" width="44" height="44" />
            {:else}
              {accountStore.active.displayName.charAt(0).toUpperCase() || '?'}
            {/if}
          </button>
        </div>
      </header>
    {/if}

    <!-- A new Feed per account: its own reading position and state. The Feed stays mounted, hidden, while a thread is open. -->
    {#key accountStore.activeKey}
      <div hidden={!onHome}>
        <Feed client={accountStore.client()!} storageKey={accountStore.activeKey!} active={onHome} />
      </div>
      {#if threadId}
        {#key threadId}
          <Thread client={accountStore.client()!} id={threadId} />
        {/key}
      {:else if profileHandle}
        {#key profileHandle}
          <Profile client={accountStore.client()!} handle={profileHandle} />
        {/key}
      {/if}
    {/key}
  </div>

  {#if onHome}
    <!-- Floating compose button: always within reach while reading -->
    <div class="fab-area">
      <button class="fab" onclick={() => composer.show()} aria-label={t('nav.newPost')} title={t('nav.newPost')}>
        <SquarePen size={24} aria-hidden="true" />
      </button>
    </div>
  {/if}

  {#if showSettings}
    <Settings
      onClose={() => (showSettings = false)}
      onAdd={() => { loginError = ''; adding = true; showSettings = false; }}
    />
  {/if}

  <Compose />
  <Lightbox />
{/if}

{#if toast.message}
  <div class="toast" class:info={toast.kind === 'info'} role="alert">
    <span>{toast.message}</span>
    <button onclick={() => toast.hide()} aria-label={t('common.close')}><X size={16} /></button>
  </div>
{/if}

<style>
  .shell.home { padding-bottom: 5rem; } /* room for the floating button below the last item */
  .shell { max-width: 40rem; margin: 0 auto; min-height: 100dvh; border-inline: 1px solid var(--border); background: var(--bg); box-shadow: 0 0 2rem rgb(0 0 0 / 0.2); padding-bottom: 0; }
  .top { display: flex; justify-content: space-between; align-items: center; padding: 0.7rem 1rem; background: var(--header); border-bottom: 1px solid var(--border); }
  .top.sticky { justify-content: flex-start; gap: 0.5rem; padding: 0.6rem 0.5rem; position: sticky; top: 0; z-index: 3; background: var(--header); border-bottom: 1px solid var(--border); padding-bottom: 0.7rem; }
  .brand { display: flex; align-items: center; gap: 0.65rem; }
  .brand img { border-radius: var(--radius-avatar); display: block; }
  .brand strong { font-size: 1.5rem; letter-spacing: -0.01em; }
  .top .right { display: flex; gap: 0.5rem; align-items: center; min-width: 0; }
  .top button { border: 0; background: var(--bg); color: var(--text); border-radius: 0.75rem; }
  .top button.icon { display: inline-flex; align-items: center; justify-content: center; width: 2.75rem; height: 2.75rem; padding: 0; }
  .top.sticky button.icon { background: none; }
  .top button.avatar { display: inline-flex; align-items: center; justify-content: center; width: 2.75rem; height: 2.75rem; padding: 0; border-radius: var(--radius-avatar); background: var(--accent); color: var(--on-accent); font-size: 1.05rem; font-weight: 700; overflow: hidden; }
  .top button.avatar img { width: 100%; height: 100%; object-fit: cover; display: block; border: var(--avatar-border); border-radius: var(--radius-avatar); }
  /* The button floats at the bottom right of the reading column and stays put while scrolling */
  .fab-area { position: sticky; bottom: 0; z-index: 4; max-width: 40rem; margin: 0 auto; height: 0; pointer-events: none; }
  .fab { position: absolute; right: 1rem; bottom: calc(1rem + env(safe-area-inset-bottom)); display: inline-flex; align-items: center; justify-content: center; width: 3.5rem; height: 3.5rem; border: 0; border-radius: var(--radius-avatar); background: var(--accent); color: var(--on-accent); box-shadow: 0 6px 18px rgb(0 0 0 / 0.35); pointer-events: auto; }
  .toast { position: fixed; left: 50%; bottom: calc(1.2rem + env(safe-area-inset-bottom)); transform: translateX(-50%); z-index: 30; display: flex; gap: 0.8rem; align-items: center; max-width: min(32rem, calc(100vw - 2rem)); padding: 0.7rem 1rem; border-radius: 0.6rem; background: var(--danger-bg); color: var(--on-danger-bg); box-shadow: 0 4px 16px rgb(0 0 0 / 0.3); }
  .toast.info { background: var(--accent); color: var(--on-accent); }
  .toast button { display: inline-flex; background: none; border: 0; color: inherit; padding: 0.2rem; }
  .loading { text-align: center; margin-top: 3rem; color: var(--muted); }
</style>
