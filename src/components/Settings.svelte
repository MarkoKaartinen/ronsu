<script lang="ts">
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import { accountStore } from '../lib/stores/accounts.svelte';
  import { t } from '../lib/stores/i18n.svelte';
  import AccountSwitcher from './AccountSwitcher.svelte';
  import FontSettings from './FontSettings.svelte';
  import LanguageSettings from './LanguageSettings.svelte';
  import ThemeSettings from './ThemeSettings.svelte';

  let { onAdd, onClose }: { onAdd: () => void; onClose: () => void } = $props();
</script>

<div class="settings" role="region" aria-label={t('settings.title')}>
  <header>
    <button class="back" onclick={onClose} aria-label={t('common.back')}><ArrowLeft size={22} /></button>
    <strong>{t('settings.title')}</strong>
  </header>

  <div class="content">
    <AccountSwitcher {onAdd} />
    <ThemeSettings />
    <FontSettings />
    <LanguageSettings />

    <div class="foot">
      {#if accountStore.active}
        <button class="logout" onclick={() => accountStore.remove(accountStore.active!.key)}>
          {t('settings.logout')} @{accountStore.active.acct}
        </button>
      {/if}
      <p class="about"><img src="/icon-192.png" alt="" width="20" height="20" />Ronsu {__APP_VERSION__}</p>
    </div>
  </div>
</div>

<style>
  .settings { position: fixed; inset: 0; z-index: 20; display: flex; flex-direction: column; background: var(--bg); overscroll-behavior: contain; }
  header { flex: none; display: flex; align-items: center; gap: 0.25rem; padding: 0.6rem 0.5rem; border-bottom: 1px solid var(--border); max-width: 40rem; width: 100%; margin: 0 auto; box-sizing: border-box; }
  header strong { font-size: 1.1rem; }
  .back { display: inline-flex; align-items: center; justify-content: center; width: 2.75rem; height: 2.75rem; border: 0; background: none; color: var(--text); }
  .content { flex: 1; overflow-y: auto; padding: 1.2rem 1rem calc(2rem + env(safe-area-inset-bottom)); max-width: 40rem; width: 100%; margin: 0 auto; box-sizing: border-box; display: flex; flex-direction: column; gap: 1.8rem; }
  .foot { margin-top: auto; }
  .logout { width: 100%; min-height: 3rem; border: 1px solid var(--border); border-radius: 0.9rem; background: none; color: var(--danger); font-weight: 700; }
  .about { display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin: 1.3rem 0 0; color: var(--muted); font-size: 0.85rem; }
  .about img { border-radius: 6px; }
</style>
