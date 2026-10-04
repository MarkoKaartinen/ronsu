<script lang="ts">
  import App from '../App.svelte';
  import CrashScreen from './CrashScreen.svelte';
</script>

<!-- If rendering the app throws, show a readable error with a way out instead of a blank screen -->
<svelte:boundary onerror={(e) => console.error('Ronsu crashed:', e)}>
  <App />
  {#snippet failed(error, reset)}
    <CrashScreen {error} retry={reset} />
  {/snippet}
</svelte:boundary>
