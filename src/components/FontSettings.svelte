<script lang="ts">
  import Check from '@lucide/svelte/icons/check';
  import { FONTS } from '../lib/fonts';
  import { t } from '../lib/stores/i18n.svelte';
  import { fontStore } from '../lib/stores/font.svelte';
</script>

<section>
  <h2>{t('settings.font')}</h2>
  <div class="cards">
    {#each FONTS as font (font.id)}
      {@const selected = fontStore.id === font.id}
      <button class="card" class:selected aria-pressed={selected} onclick={() => fontStore.set(font.id)}>
        <!-- The card is drawn in its own font, so it works as a preview -->
        <span class="sample" style:font-family={font.stack} aria-hidden="true">Aa</span>
        <span class="name">{font.name ?? t('settings.system')}</span>
        {#if selected}
          <span class="check"><Check size={14} aria-hidden="true" /></span>
        {/if}
      </button>
    {/each}
  </div>
</section>

<style>
  h2 { margin: 0 0 0.6rem; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
  .cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.6rem; }
  .card { position: relative; display: grid; gap: 0.15rem; justify-items: start; padding: 0.7rem 0.8rem; border: 2px solid var(--border); border-radius: 0.8rem; background: var(--surface); color: var(--text); text-align: left; }
  .card.selected { border-color: var(--accent); }
  .sample { font-size: 1.6rem; line-height: 1.2; }
  .name { font-size: 0.85rem; font-weight: 600; color: var(--muted); }
  .check { position: absolute; top: 0.5rem; right: 0.5rem; display: inline-flex; align-items: center; justify-content: center; width: 1.3rem; height: 1.3rem; border-radius: 50%; background: var(--accent); color: var(--on-accent); }
</style>
