<script lang="ts">
  import { LOCALE_NAMES, LOCALES } from '../lib/i18n';
  import { i18n, t } from '../lib/stores/i18n.svelte';
</script>

<section>
  <h2>{t('settings.language')}</h2>
  <div class="seg" role="group" aria-label={t('settings.language')}>
    {#each LOCALES as locale (locale)}
      <!-- Each language is named in itself and marked with lang, so it reads correctly in any UI language -->
      <button lang={locale} class:on={i18n.locale === locale} aria-pressed={i18n.locale === locale} onclick={() => i18n.set(locale)}>
        {LOCALE_NAMES[locale]}
      </button>
    {/each}
  </div>
</section>

<style>
  h2 { margin: 0 0 0.6rem; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
  .seg { display: flex; gap: 0.25rem; padding: 0.25rem; border-radius: 0.9rem; background: var(--surface); }
  .seg button { flex: 1; min-height: 2.75rem; border: 0; border-radius: 0.65rem; background: none; color: var(--muted); font-weight: 600; }
  .seg button.on { background: var(--accent); color: var(--on-accent); font-weight: 700; }
</style>
