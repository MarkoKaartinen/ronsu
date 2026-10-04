<script lang="ts">
  import { resetAndReload } from '../lib/recovery';
  import { t } from '../lib/stores/i18n.svelte';

  /** `error` is whatever was thrown; `retry` re-renders the app (Svelte's boundary reset) */
  let { error, retry }: { error: unknown; retry: () => void } = $props();

  const detail = $derived(error instanceof Error ? error.message : String(error));
</script>

<main class="crash" role="alert">
  <h1>{t('crash.title')}</h1>
  <p>{t('crash.explanation')}</p>
  <p class="muted">{t('crash.addons')}</p>
  {#if detail}<pre>{detail}</pre>{/if}
  <div class="actions">
    <button class="primary" onclick={retry}>{t('common.retry')}</button>
    <button onclick={resetAndReload}>{t('crash.reset')}</button>
  </div>
</main>

<style>
  .crash { max-width: 28rem; margin: 0 auto; min-height: 100dvh; box-sizing: border-box; padding: 3rem 1.5rem; display: flex; flex-direction: column; justify-content: center; gap: 0.8rem; }
  h1 { margin: 0; font-size: 1.8rem; }
  p { margin: 0; line-height: 1.5; }
  .muted { color: var(--muted); font-size: 0.9rem; }
  pre { margin: 0; padding: 0.7rem 0.9rem; border-radius: 0.6rem; background: var(--surface); color: var(--muted); font-size: 0.8rem; white-space: pre-wrap; overflow-wrap: anywhere; max-height: 9rem; overflow: auto; }
  .actions { display: grid; gap: 0.6rem; margin-top: 0.6rem; }
  button { min-height: 3rem; border: 1px solid var(--border); border-radius: 0.9rem; background: var(--surface); color: var(--text); font: inherit; font-weight: 600; }
  button.primary { border: 0; background: var(--accent); color: var(--on-accent); font-weight: 700; }
</style>
