<script lang="ts">
  import { t } from '../lib/stores/i18n.svelte';

  interface Props {
    /** Local preview of the picture being described */
    preview: string;
    description: string;
    limit: number;
    onDone: (description: string) => void;
    onCancel: () => void;
  }

  let { preview, description, limit, onDone, onCancel }: Props = $props();

  let dialog: HTMLDialogElement | undefined = $state();
  // Only the starting value matters: the text is edited here and handed back with Done
  // svelte-ignore state_referenced_locally
  let text = $state(description);

  $effect(() => {
    if (dialog && !dialog.open) dialog.showModal();
  });
</script>

<dialog bind:this={dialog} aria-labelledby="alt-title" oncancel={(e) => { e.preventDefault(); onCancel(); }}>
  <form onsubmit={(e) => { e.preventDefault(); onDone(text.trim()); }}>
    <header>
      <button type="button" class="cancel" onclick={onCancel}>{t('common.cancel')}</button>
      <h2 id="alt-title">{t('compose.alt.title')}</h2>
      <button type="submit" class="done" disabled={text.length > limit}>{t('compose.alt.done')}</button>
    </header>
    <img src={preview} alt="" />
    <!-- svelte-ignore a11y_autofocus -->
    <textarea
      bind:value={text}
      autofocus
      rows="5"
      aria-label={t('compose.alt.title')}
      placeholder={t('compose.alt.placeholder')}
    ></textarea>
    <span class="count" class:over={text.length > limit}>{text.length} / {limit}</span>
  </form>
</dialog>

<style>
  dialog {
    width: min(36rem, 100vw);
    max-width: 100vw;
    max-height: 100dvh;
    margin: auto auto 0;
    padding: 0;
    border: 1px solid var(--border);
    border-bottom: 0;
    border-radius: 1.4rem 1.4rem 0 0;
    background: var(--bg);
    color: var(--text);
  }
  @media (max-width: 40rem) {
    dialog { height: 100dvh; margin: 0; border: 0; border-radius: 0; }
  }
  dialog::backdrop { background: rgb(0 0 0 / 0.55); }
  form { display: flex; flex-direction: column; gap: 0.6rem; height: 100%; box-sizing: border-box; padding: 0.6rem 1rem calc(1rem + env(safe-area-inset-bottom)); }
  header { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
  h2 { margin: 0; font-size: 1.05rem; }
  .cancel { min-height: 2.75rem; padding: 0 0.6rem; border: 0; background: none; color: var(--muted); font-weight: 500; font-size: 1rem; margin-left: -0.6rem; }
  .done { height: 2.75rem; padding: 0 1.3rem; border: 0; border-radius: 1.4rem; background: var(--accent); color: var(--on-accent); font-weight: 700; font-size: 1rem; }
  .done:disabled { opacity: 0.5; }
  img { align-self: center; max-width: 100%; max-height: 30dvh; min-height: 0; object-fit: contain; border-radius: 0.7rem; }
  textarea { flex: 1; min-height: 6rem; box-sizing: border-box; width: 100%; padding: 0.6rem 0.8rem; font: inherit; font-size: 1.05rem; line-height: 1.5; border: 1px solid var(--border); border-radius: 0.7rem; background: var(--surface); color: var(--text); resize: none; }
  .count { align-self: flex-end; color: var(--muted); font-weight: 600; font-size: 0.9rem; font-variant-numeric: tabular-nums; }
  .count.over { color: var(--danger); font-weight: 700; }
</style>
