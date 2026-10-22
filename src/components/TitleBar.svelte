<script lang="ts">
  let { title }: { title: string } = $props();
</script>

<!-- The bar at the top of a view that has nothing else in it: the same height and look as the feed's bar -->
<div class="bar"><strong>{title}</strong></div>

<style>
  .bar { position: sticky; top: var(--sticky-top, 0); z-index: 2; box-sizing: content-box; display: flex; align-items: center; min-height: var(--bar-row); padding: var(--bar-pt) 1rem var(--bar-pb); background: var(--bg); border-bottom: 1px solid var(--border); }
</style>
