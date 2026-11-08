<script lang="ts">
  import { keysOf } from '../lib/shortcuts';
  import { t } from '../lib/stores/i18n.svelte';

  /** A binding written as keys on a keyboard; an empty one is a shortcut that is switched off */
  let { binding }: { binding: string } = $props();
</script>

{#each keysOf(binding) as key, i (i)}<kbd>{key}</kbd>{' '}{:else}<span class="off">{t('shortcuts.off')}</span>{/each}

<style>
  kbd { display: inline-block; min-width: 1.5rem; padding: 0.1rem 0.4rem; box-sizing: border-box; border: 1px solid var(--border); border-bottom-width: 2px; border-radius: 0.35rem; background: var(--surface); font: inherit; font-size: 0.85rem; font-weight: 600; text-align: center; }
  .off { color: var(--muted); font-size: 0.85rem; }
</style>
