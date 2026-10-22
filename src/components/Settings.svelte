<script lang="ts">
  import { REPO_URL } from '../lib/app';
  import { accountStore } from '../lib/stores/accounts.svelte';
  import { t } from '../lib/stores/i18n.svelte';
  import { toast } from '../lib/stores/toast.svelte';
  import AccountSwitcher from './AccountSwitcher.svelte';
  import FontSettings from './FontSettings.svelte';
  import LanguageSettings from './LanguageSettings.svelte';
  import TitleBar from './TitleBar.svelte';
  import PushSettings from './PushSettings.svelte';
  import ThemeSettings from './ThemeSettings.svelte';

  let { onAdd }: { onAdd: () => void } = $props();

  /** Logs out here for certain; says whether the server confirmed the revoking, and how to do it by hand if it did not */
  async function logout() {
    const acc = accountStore.active;
    if (!acc) return;
    try {
      const result = await accountStore.remove(acc.key);
      if (result?.ok) toast.show(t('settings.logout.revoked'), 'info');
      else toast.show(t('settings.logout.notRevoked', { instance: acc.instance }), 'error', 20_000);
    } catch (e) {
      toast.show(t('settings.logout.failed', { message: e instanceof Error ? e.message : String(e) }), 'error', 20_000);
    }
  }
</script>

<div class="settings" role="region" aria-label={t('settings.title')}>
  <TitleBar title={t('settings.title')} />

  <div class="content">
    <AccountSwitcher {onAdd} />
    <PushSettings />
    <ThemeSettings />
    <FontSettings />
    <LanguageSettings />

    <div class="foot">
      {#if accountStore.active}
        <button class="logout" onclick={logout}>
          {t('settings.logout')} @{accountStore.active.acct}
        </button>
      {/if}
      <p class="about"><img src="/icon-192.png" alt="" width="20" height="20" />Ronsu {__APP_VERSION__} ·
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub</a></p>
    </div>
  </div>
</div>

<style>
  .settings { display: flex; flex-direction: column; }
  .content { flex: 1; padding: 1.2rem 1rem 2rem; box-sizing: border-box; display: flex; flex-direction: column; gap: 1.8rem; }
  .foot { margin-top: auto; }
  .logout { width: 100%; min-height: 3rem; border: 1px solid var(--border); border-radius: 0.9rem; background: none; color: var(--danger); font-weight: 700; }
  .about { display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin: 1.3rem 0 0; color: var(--muted); font-size: 0.85rem; }
  .about a { color: inherit; }
  .about img { border-radius: 6px; }
</style>
