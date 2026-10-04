<script lang="ts">
  import { accountStore } from '../lib/stores/accounts.svelte';
  import { t } from '../lib/stores/i18n.svelte';

  let { onAdd }: { onAdd: () => void } = $props();
</script>

<section>
  <h2>{t('settings.accounts')}</h2>
  <ul>
    {#each accountStore.accounts as acc (acc.key)}
      <li class:active={acc.key === accountStore.activeKey}>
        {#if acc.avatar}
          <img src={acc.avatar} alt="" width="44" height="44" />
        {:else}
          <span class="initial" aria-hidden="true">{acc.displayName.charAt(0).toUpperCase() || '?'}</span>
        {/if}
        <span class="who">
          <strong>{acc.displayName}</strong>
          <small>@{acc.acct}@{acc.instance}</small>
        </span>
        {#if acc.key === accountStore.activeKey}
          <span class="current">{t('settings.active')}</span>
        {:else}
          <button class="switch" onclick={() => accountStore.switchTo(acc.key)} aria-label={t('settings.switchTo', { acct: acc.acct })}>{t('settings.switch')}</button>
        {/if}
      </li>
    {/each}
  </ul>
  <button class="add" onclick={onAdd}>{t('settings.addAccount')}</button>
</section>

<style>
  h2 { margin: 0 0 0.6rem; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
  ul { list-style: none; margin: 0 0 0.5rem; padding: 0; display: grid; gap: 0.5rem; }
  li { display: flex; gap: 0.75rem; align-items: center; border: 1px solid var(--border); border-radius: 0.9rem; padding: 0.75rem; }
  li.active { border: 1.5px solid var(--accent); background: var(--surface); }
  img, .initial { width: 2.75rem; height: 2.75rem; border-radius: var(--radius-avatar); flex: none; }
  img { border: var(--avatar-border); }
  .initial { display: inline-flex; align-items: center; justify-content: center; background: var(--accent); color: var(--on-accent); font-weight: 700; }
  .who { flex: 1; display: grid; min-width: 0; }
  small { color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .current { color: var(--accent); font-size: 0.85rem; font-weight: 700; }
  .switch { min-height: 2.75rem; padding: 0 0.8rem; border: 1px solid var(--border); border-radius: 0.6rem; background: none; color: var(--text); font-weight: 600; }
  .add { width: 100%; min-height: 3rem; border: 1px dashed var(--border); border-radius: 0.9rem; background: none; color: var(--accent); font-weight: 700; }
</style>
