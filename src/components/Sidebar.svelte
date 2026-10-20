<script lang="ts">
    import House from '@lucide/svelte/icons/house';
  import Mail from '@lucide/svelte/icons/mail';
  import Plus from '@lucide/svelte/icons/plus';
  import Settings from '@lucide/svelte/icons/settings';
  import { accountStore } from '../lib/stores/accounts.svelte';
  import { composer } from '../lib/stores/composer.svelte';
  import { t } from '../lib/stores/i18n.svelte';
  import { messages } from '../lib/stores/messages.svelte';

  let { homeActive, messagesActive, onHome, onMessages, onSettings }: { homeActive: boolean; messagesActive: boolean; onHome: () => void; onMessages: () => void; onSettings: () => void } = $props();

  const account = $derived(accountStore.active);
</script>

<!-- The wide screen's navigation: the brand and the places on top, the post button, the account at the bottom -->
<nav class="side" aria-label={t('nav.main')}>
  <button class="brand" onclick={onHome} title={t('nav.home')}>
    <img src="/icon-192.png" alt="" width="40" height="40" />
    <strong>Ronsu</strong>
  </button>

  <div class="links">
    <button class="link" class:on={homeActive} aria-current={homeActive ? 'page' : undefined} onclick={onHome} title={t('nav.home')}>
      <House size={22} aria-hidden="true" />
      <span class="label">{t('nav.home')}</span>
    </button>
    <button class="link" class:on={messagesActive} aria-current={messagesActive ? 'page' : undefined} aria-label={messages.hasNew ? t('nav.messagesNew') : t('nav.messages')} onclick={onMessages} title={t('nav.messages')}>
      <span class="mail">
        <Mail size={22} aria-hidden="true" />
        {#if messages.hasNew}<span class="dot" aria-hidden="true"></span>{/if}
      </span>
      <span class="label">{t('nav.messages')}</span>
    </button>
  </div>

  <button class="post" onclick={() => composer.show()} aria-label={t('nav.newPost')} title={t('nav.newPost')}>
    <Plus size={22} aria-hidden="true" />
    <span class="label">{t('nav.newPost')}</span>
  </button>

  <button class="account" onclick={onSettings} aria-label={t('nav.account', { acct: account?.acct ?? '' })} title={t('settings.title')}>
    <span class="avatar">
      {#if account?.avatar}
        <img src={account.avatar} alt="" width="40" height="40" />
      {:else}
        {(account?.displayName ?? '').charAt(0).toUpperCase() || '?'}
      {/if}
    </span>
    <span class="who label">
      <strong>{account?.displayName || account?.acct}</strong>
      <small>@{account?.acct}</small>
    </span>
    <span class="label more"><Settings size={20} aria-hidden="true" /></span>
  </button>
</nav>

<style>
  .side {
    flex: 0 0 var(--side-width); width: var(--side-width); position: sticky; top: 0; height: 100dvh; box-sizing: border-box;
    display: flex; flex-direction: column; gap: 0.25rem; padding: 0.9rem 0.6rem; overflow-y: auto;
    background: var(--header); border-left: 1px solid var(--border); border-right: 1px solid var(--border);
  }
  button { border: 0; background: none; color: var(--text); font: inherit; text-align: left; }
  .brand { display: flex; align-items: center; gap: 0.65rem; padding: 0.2rem 0.4rem; margin-bottom: 0.9rem; }
  .brand img { border-radius: var(--radius-avatar); display: block; flex: none; }
  .brand strong { font-size: 1.5rem; letter-spacing: -0.01em; }
  .links { display: flex; flex-direction: column; gap: 0.15rem; }
  .link { display: flex; align-items: center; gap: 0.8rem; min-height: 3rem; padding: 0 0.85rem; border-radius: 0.9rem; font-weight: 600; color: var(--muted); }
  .link:hover { background: color-mix(in srgb, var(--accent) 8%, transparent); color: var(--text); }
  .link.on { background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--text); }
  .link.on :global(svg) { color: var(--accent); }
  .mail { position: relative; display: inline-flex; }
  /* A red ball on the envelope: a private mention has not been read */
  .dot { position: absolute; top: -0.15rem; right: -0.3rem; width: 0.65rem; height: 0.65rem; border-radius: 50%; background: var(--danger); border: 2px solid var(--header); box-sizing: content-box; }
  .post { display: flex; align-items: center; justify-content: center; gap: 0.5rem; align-self: flex-start; min-height: 3rem; margin-top: 1rem; padding: 0 1.2rem; border-radius: 999px; background: var(--accent); color: var(--on-accent); font-weight: 700; box-shadow: 0 2px 8px rgb(0 0 0 / 0.25); }
  /* Pushed to the bottom by the free space above it */
  .account { display: flex; align-items: center; gap: 0.65rem; margin-top: auto; padding: 0.5rem; border-radius: 1rem; min-width: 0; }
  .account:hover { background: color-mix(in srgb, var(--accent) 8%, transparent); }
  .account:hover .more { color: var(--text); }
  .avatar { display: inline-flex; align-items: center; justify-content: center; flex: none; width: 2.5rem; height: 2.5rem; border-radius: var(--radius-avatar); background: var(--accent); color: var(--on-accent); font-weight: 700; overflow: hidden; }
  .avatar img { width: 100%; height: 100%; object-fit: cover; display: block; border: var(--avatar-border); border-radius: var(--radius-avatar); }
  .who { display: flex; flex-direction: column; min-width: 0; flex: 1; line-height: 1.25; }
  .who strong, .who small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .who small { color: var(--muted); }
  .more { display: inline-flex; flex: none; color: var(--muted); }

  /* A rail of icons while the screen is too narrow for the labels as well as the feed and the notifications */
  @media (max-width: 1179px) {
    .side { align-items: center; padding-inline: 0.4rem; }
    .label { display: none; }
    .brand { padding: 0; }
    .brand strong { display: none; }
    .link { justify-content: center; width: 3rem; padding: 0; }
    .post { align-self: center; width: 3rem; padding: 0; }
    .account { padding: 0.25rem; }
  }
</style>
