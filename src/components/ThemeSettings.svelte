<script lang="ts">
  import Check from '@lucide/svelte/icons/check';
  import type { MessageKey } from '../lib/i18n';
  import { t } from '../lib/stores/i18n.svelte';
  import { themeStore } from '../lib/stores/theme.svelte';
  import type { Theme, ThemeMode } from '../lib/themes';

  const modes: { id: ThemeMode; label: MessageKey }[] = [
    { id: 'system', label: 'settings.system' },
    { id: 'light', label: 'settings.light' },
    { id: 'dark', label: 'settings.dark' },
  ];
  const groups: { scheme: 'light' | 'dark'; label: MessageKey }[] = [
    { scheme: 'light', label: 'settings.lightTheme' },
    { scheme: 'dark', label: 'settings.darkTheme' },
  ];
  const themeName = (theme: Theme) => t(`theme.${theme.id}` as MessageKey);
  const chosen = (scheme: 'light' | 'dark') => themeStore.prefs[scheme];
</script>

<section>
  <h2>{t('settings.theme')}</h2>

  <!-- 1. When to use light or dark -->
  <div class="seg" role="group" aria-label={t('settings.themeMode')}>
    {#each modes as m (m.id)}
      <button class:on={themeStore.prefs.mode === m.id} aria-pressed={themeStore.prefs.mode === m.id} onclick={() => themeStore.set({ mode: m.id })}>
        {t(m.label)}
      </button>
    {/each}
  </div>

  <!-- 2. Which theme to use for light and for dark: pick a card in each group -->
  {#each groups as group (group.scheme)}
    <div class="group" role="group" aria-label={t(group.label)}>
      <h3>{t(group.label)}</h3>
      <div class="cards">
        {#each themeStore.options(group.scheme) as theme (theme.id)}
          {@const selected = chosen(group.scheme) === theme.id}
          <button
            class="card"
            class:selected
            aria-pressed={selected}
            style:background={theme.colors.bg}
            style:color={theme.colors.text}
            style:border-color={selected ? theme.colors.accent : theme.colors.border}
            onclick={() => themeStore.set({ [group.scheme]: theme.id })}
          >
            <span class="name">{themeName(theme)}</span>
            <span class="bar" style:background={theme.colors.accent}></span>
            {#if selected}
              <span class="check" style:background={theme.colors.accent} style:color={theme.colors.onAccent}><Check size={14} aria-hidden="true" /></span>
            {/if}
          </button>
        {/each}
      </div>
    </div>
  {/each}
</section>

<style>
  h2 { margin: 0 0 0.6rem; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
  h3 { margin: 0 0 0.4rem; font-size: 0.9rem; font-weight: 600; color: var(--muted); }
  .seg { display: flex; gap: 0.25rem; padding: 0.25rem; border-radius: 0.9rem; background: var(--surface); }
  .seg button { flex: 1; min-height: 2.75rem; border: 0; border-radius: 0.65rem; background: none; color: var(--muted); font-weight: 600; }
  .seg button.on { background: var(--accent); color: var(--on-accent); font-weight: 700; }
  .group { margin-top: 1rem; }
  .cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.6rem; }
  /* A card is a small preview of the theme itself, so it is drawn in the theme's own colours */
  .card { position: relative; display: grid; gap: 0.5rem; justify-items: start; padding: 0.8rem; border: 2px solid; border-radius: 0.8rem; text-align: left; font-size: 0.95rem; font-weight: 600; }
  .card .bar { display: block; width: 55%; height: 6px; border-radius: 3px; }
  .card .check { position: absolute; top: 0.5rem; right: 0.5rem; display: inline-flex; align-items: center; justify-content: center; width: 1.3rem; height: 1.3rem; border-radius: 50%; }
</style>
