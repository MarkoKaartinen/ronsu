<script lang="ts">
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import SquarePen from '@lucide/svelte/icons/square-pen';
  import X from '@lucide/svelte/icons/x';
  import { onMount, tick, untrack } from 'svelte';
  import { finishLogin, hasOAuthCallback, missingScopes, startLogin } from './lib/api/oauth';
  import { accountStore } from './lib/stores/accounts.svelte';
  import Login from './components/Login.svelte';
  import Compose from './components/Compose.svelte';
  import Lightbox from './components/Lightbox.svelte';
  import BottomBar from './components/BottomBar.svelte';
  import Feed from './components/Feed.svelte';
  import Notifications from './components/Notifications.svelte';
  import Profile from './components/Profile.svelte';
  import Thread from './components/Thread.svelte';
  import Settings from './components/Settings.svelte';
  import { fontStore } from './lib/stores/font.svelte';
  import { themeStore } from './lib/stores/theme.svelte';
  import { router } from './lib/router.svelte';
  import { composer } from './lib/stores/composer.svelte';
  import { push } from './lib/stores/push.svelte';
  import { unread } from './lib/stores/unread.svelte';
  import { t } from './lib/stores/i18n.svelte';
  import { toast } from './lib/stores/toast.svelte';

  let loginError = $state('');
  let adding = $state(false);
  let showSettings = $state(false);

  /** The app wants permissions the login does not have (they were added after it): once per start the reader is asked to log in again */
  let reauthDismissed = $state(false);
  const needsReauth = $derived(!!accountStore.active && missingScopes(accountStore.active.scopes).length > 0);
  const reauth = () => accountStore.active && startLogin(accountStore.active.instance).catch((e) => toast.show(e instanceof Error ? e.message : String(e)));

  const threadId = $derived(router.route.name === 'thread' ? router.route.id : null);
  const profileHandle = $derived(router.route.name === 'profile' ? router.route.handle : null);
  /**
   * On a wide screen the notifications are a second column beside the feed (always visible, with their own
   * scrolling) and there is no bottom bar; on a narrow one they are a view of their own (see BottomBar).
   */
  const WIDE = '(min-width: 800px)';
  let wide = $state(matchMedia(WIDE).matches);
  onMount(() => {
    const mq = matchMedia(WIDE);
    const sync = () => (wide = mq.matches);
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  });

  // A link to the notifications view opens the feed on a wide screen, where they are beside it anyway
  const onHome = $derived(router.route.name === 'home' || (wide && router.route.name === 'notifications'));
  const onNotifications = $derived(!wide && router.route.name === 'notifications');
  /** One of the two main views (with the bottom bar), as opposed to a thread or a profile */
  const tab = $derived(onHome ? 'home' : onNotifications ? 'notifications' : null);

  // The notifications are only fetched once they have been opened; after that the view stays mounted, hidden
  let notificationsOpened = $state(false);
  $effect(() => {
    if (onNotifications) notificationsOpened = true;
  });

  // Back to a main view (from a thread, a profile or the other view): restore its scroll position (both stay
  // mounted, hidden)
  let wasTab: string | null = 'home';
  $effect(() => {
    const now = tab;
    if (now && now !== wasTab) tick().then(() => window.scrollTo(0, router.tabScroll[now] ?? 0));
    wasTab = now;
  });

  /** The logo: to the feed from anywhere (a thread, a profile, the notifications); on the feed itself, back to the top */
  function goHome() {
    if (tab === 'home') window.scrollTo({ top: 0, behavior: 'smooth' });
    else router.openTab('home');
  }

  $effect(() => themeStore.apply());
  $effect(() => fontStore.apply());
  $effect(() => unread.apply());

  /**
   * Is there something new in the notifications? Asked when the account is chosen, when the app comes back into view
   * and when a push arrives. Not when the notifications are in view themselves: they see to it (and mark it seen).
   */
  function checkUnread() {
    const client = accountStore.client();
    if (!client || ((onNotifications || wide) && document.visibilityState === 'visible')) return;
    void unread.check(client);
  }
  $effect(() => {
    accountStore.activeKey;
    push.signal;
    untrack(checkUnread);
  });
  onMount(() => {
    document.addEventListener('visibilitychange', checkUnread);
    return () => document.removeEventListener('visibilitychange', checkUnread);
  });

  onMount(async () => {
    void push.init();
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
  {#snippet brandBar()}
    <header class="top">
      <button class="brand" onclick={goHome} title={t('nav.home')}>
        <img src="/icon-192.png" alt="" width="40" height="40" />
        <strong>Ronsu</strong>
      </button>
      <div class="right">
        {#if wide}
          <button class="icon compose" onclick={() => composer.show()} aria-label={t('nav.newPost')} title={t('nav.newPost')}>
            <SquarePen size={22} aria-hidden="true" />
          </button>
        {/if}
        <button class="avatar" onclick={() => (showSettings = true)} aria-label={t('nav.account', { acct: accountStore.active?.acct ?? '' })} title={t('settings.title')}>
          {#if accountStore.active?.avatar}
            <img src={accountStore.active.avatar} alt="" width="44" height="44" />
          {:else}
            {(accountStore.active?.displayName ?? '').charAt(0).toUpperCase() || '?'}
          {/if}
        </button>
      </div>
    </header>
{/snippet}

  {#if needsReauth && !reauthDismissed}
    <div class="reauth" class:wide role="status">
      <span>{t('scopes.banner')}</span>
      <button class="primary" onclick={reauth}>{t('profile.reauthButton')}</button>
      <button onclick={() => (reauthDismissed = true)}>{t('feed.notNow')}</button>
    </div>
  {/if}

  <div class="page" class:wide>
  <!-- On a wide screen the top bar spans both columns -->
  {#if wide}
    <div class="widehead">{@render brandBar()}</div>
  {/if}
  <div class="cols">
  <div class="shell" class:home={tab !== null} class:wide>
    {#if !tab}
      <header class="top sticky">
        <button class="icon" onclick={() => router.back()} aria-label={t('common.back')}><ArrowLeft size={22} /></button>
        <strong>{threadId ? t('thread.title') : t('profile.title')}</strong>
      </header>
    {:else if !wide}
      {@render brandBar()}
    {/if}

    <!-- A new Feed per account: its own reading position and state. The Feed stays mounted, hidden, while a thread is open. -->
    {#key accountStore.activeKey}
      <div hidden={!onHome}>
        <Feed client={accountStore.client()!} storageKey={accountStore.activeKey!} active={onHome} />
      </div>
      {#if notificationsOpened && !wide}
        <div hidden={!onNotifications}>
          <Notifications client={accountStore.client()!} active={onNotifications} />
        </div>
      {/if}
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

  {#if wide}
    <aside class="aside" aria-label={t('nav.notifications')}>
      {#key accountStore.activeKey}
        <Notifications client={accountStore.client()!} active />
      {/key}
    </aside>
  {/if}
  </div>
  </div>

  {#if tab && !wide}
    <BottomBar current={tab} />
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
  /* From 800 px up: the feed and a notifications column (46 % of the width, at most 30 rem) under one top bar; below that
     it is the narrow view with the bottom bar */
  .page { max-width: 64rem; margin: 0 auto; }
  /* The top bar stays in place while scrolling; what else sticks (the feed's bar, a thread's back bar, the second
     column) starts below it, by this height */
  .page.wide { --sticky-top: 4.25rem; }
  .widehead { position: sticky; top: 0; z-index: 6; }
  .widehead :global(.top) { height: var(--sticky-top); box-sizing: border-box; padding-block: 0; }
  .widehead :global(.top) { border-inline: 1px solid var(--border); box-shadow: 0 0 2rem rgb(0 0 0 / 0.2); }
  .cols { display: flex; align-items: flex-start; }
  /* A flex item is as wide as its content unless told otherwise: on a phone the column must be the width of the screen */
  .cols .shell { width: 100%; min-width: 0; }
  .cols .shell.wide { margin: 0; max-width: none; flex: 1 1 0; min-width: 0; box-shadow: none; }
  /* The second column: as high as the screen and scrolling on its own, while the feed scrolls with the page */
  .aside { flex: 0 0 clamp(19rem, 46%, 30rem); position: sticky; top: var(--sticky-top, 0); height: calc(100dvh - var(--sticky-top, 0px)); overflow-y: auto; overscroll-behavior: contain; background: var(--bg); border-right: 1px solid var(--border); padding-bottom: 1rem; box-sizing: border-box; }
  .shell.wide.home { padding-bottom: 2rem; }
  .shell.home { padding-bottom: calc(5.5rem + var(--inset-bottom)); } /* room for the bottom bar below the last item */
  .shell { max-width: 40rem; margin: 0 auto; min-height: 100dvh; border-inline: 1px solid var(--border); background: var(--bg); box-shadow: 0 0 2rem rgb(0 0 0 / 0.2); padding-bottom: 0; }
  .top { display: flex; justify-content: space-between; align-items: center; padding: 0.7rem 1rem; background: var(--header); border-bottom: 1px solid var(--border); }
  .top.sticky { justify-content: flex-start; gap: 0.5rem; padding: 0.6rem 0.5rem; position: sticky; top: var(--sticky-top, 0); z-index: 3; background: var(--header); border-bottom: 1px solid var(--border); padding-bottom: 0.7rem; }
  .top button.brand { display: flex; align-items: center; gap: 0.65rem; padding: 0; background: none; border-radius: 0; color: inherit; font: inherit; }
  .brand img { border-radius: var(--radius-avatar); display: block; }
  .brand strong { font-size: 1.5rem; letter-spacing: -0.01em; }
  .top .right { display: flex; gap: 0.5rem; align-items: center; min-width: 0; }
  .top button { border: 0; background: var(--bg); color: var(--text); border-radius: 0.75rem; }
  .top button.icon { display: inline-flex; align-items: center; justify-content: center; width: 2.75rem; height: 2.75rem; padding: 0; }
  .top.sticky button.icon { background: none; }
  .top button.icon.compose { background: var(--accent); color: var(--on-accent); box-shadow: 0 2px 8px rgb(0 0 0 / 0.3); }
  .top button.avatar { display: inline-flex; align-items: center; justify-content: center; width: 2.75rem; height: 2.75rem; padding: 0; border-radius: var(--radius-avatar); background: var(--accent); color: var(--on-accent); font-size: 1.05rem; font-weight: 700; overflow: hidden; }
  .top button.avatar img { width: 100%; height: 100%; object-fit: cover; display: block; border: var(--avatar-border); border-radius: var(--radius-avatar); }
  .toast { position: fixed; left: 50%; bottom: calc(1.2rem + env(safe-area-inset-bottom)); transform: translateX(-50%); z-index: 30; display: flex; gap: 0.8rem; align-items: center; max-width: min(32rem, calc(100vw - 2rem)); padding: 0.7rem 1rem; border-radius: 0.6rem; background: var(--danger-bg); color: var(--on-danger-bg); box-shadow: 0 4px 16px rgb(0 0 0 / 0.3); }
  .toast.info { background: var(--accent); color: var(--on-accent); }
  .toast button { display: inline-flex; background: none; border: 0; color: inherit; padding: 0.2rem; }
  /* As wide as the page below it (one column, or the two columns on a wide screen), with the same side lines */
  .reauth { display: flex; gap: 0.5rem 0.75rem; align-items: center; flex-wrap: wrap; max-width: 40rem; margin: 0 auto; padding: 0.7rem 1rem; background: color-mix(in srgb, var(--accent) 16%, var(--bg)); border-inline: 1px solid var(--border); border-bottom: 1px solid var(--accent); font-size: 0.9rem; font-weight: 600; box-sizing: border-box; }
  .reauth.wide { max-width: 64rem; }
  .reauth span { flex: 1; min-width: 14rem; }
  .reauth button { border: 1px solid var(--border); background: var(--bg); color: var(--text); border-radius: 0.4rem; padding: 0.4rem 0.9rem; min-height: 2.5rem; }
  .reauth .primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); font-weight: 600; }
  .loading { text-align: center; margin-top: 3rem; color: var(--muted); }
</style>
