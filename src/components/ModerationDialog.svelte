<script lang="ts" module>
  /** What the dialog asks about: how long to mute, or only whether to go through with a block */
  export type Ask = { kind: 'mute'; name: string } | { kind: 'block'; name: string } | { kind: 'domain'; domain: string } | { kind: 'delete' };
</script>

<script lang="ts">
  import type { MessageKey } from '../lib/i18n';
  import { MUTE_DURATIONS } from '../lib/moderation';
  import { t } from '../lib/stores/i18n.svelte';

  interface Props {
    ask: Ask;
    onMute: (duration: number, notifications: boolean) => void;
    onConfirm: () => void;
    onCancel: () => void;
  }

  let { ask, onMute, onConfirm, onCancel }: Props = $props();

  const DURATION_LABELS: Record<(typeof MUTE_DURATIONS)[number], MessageKey> = {
    0: 'moderation.duration.0',
    1800: 'moderation.duration.1800',
    3600: 'moderation.duration.3600',
    21600: 'moderation.duration.21600',
    86400: 'moderation.duration.86400',
    259200: 'moderation.duration.259200',
    604800: 'moderation.duration.604800',
  };

  let dialog: HTMLDialogElement | undefined = $state();
  let duration = $state(0);
  // Hiding the notifications is Mastodon's default for a mute
  let notifications = $state(true);

  $effect(() => {
    if (dialog && !dialog.open) dialog.showModal();
  });

  const title = $derived(
    ask.kind === 'mute' ? t('moderation.muteTitle', { name: ask.name }) : ask.kind === 'block' ? t('moderation.blockTitle', { name: ask.name }) : ask.kind === 'delete' ? t('delete.title') : t('moderation.domainTitle', { domain: ask.domain }),
  );
  const action = $derived(ask.kind === 'mute' ? t('moderation.mute') : ask.kind === 'block' ? t('moderation.block') : ask.kind === 'delete' ? t('delete.confirm') : t('moderation.domainBlock'));

  function submit(e: Event) {
    e.preventDefault();
    if (ask.kind === 'mute') onMute(duration, notifications);
    else onConfirm();
  }
</script>

<dialog bind:this={dialog} aria-labelledby="moderation-title" oncancel={(e) => { e.preventDefault(); onCancel(); }}>
  <form onsubmit={submit}>
    <h2 id="moderation-title">{title}</h2>
    {#if ask.kind === 'mute'}
      <label class="field">
        <span>{t('moderation.duration')}</span>
        <select bind:value={duration}>
          {#each MUTE_DURATIONS as seconds (seconds)}
            <option value={seconds}>{t(DURATION_LABELS[seconds])}</option>
          {/each}
        </select>
      </label>
      <label class="check">
        <input type="checkbox" bind:checked={notifications} />
        <span>{t('moderation.hideNotifications')}</span>
      </label>
    {:else if ask.kind === 'block'}
      <p>{t('moderation.blockText', { name: `@${ask.name}` })}</p>
    {:else if ask.kind === 'delete'}
      <p>{t('delete.text')}</p>
    {:else}
      <p>{t('moderation.domainText', { domain: ask.domain })}</p>
    {/if}
    <div class="buttons">
      <button type="button" class="cancel" onclick={onCancel}>{t('common.cancel')}</button>
      <button type="submit" class="confirm" class:danger={ask.kind !== 'mute'}>{action}</button>
    </div>
  </form>
</dialog>

<style>
  dialog { width: min(26rem, calc(100vw - 2rem)); padding: 0; border: 1px solid var(--border); border-radius: 1.2rem; background: var(--bg); color: var(--text); }
  dialog::backdrop { background: rgb(0 0 0 / 0.55); }
  form { display: flex; flex-direction: column; gap: 0.9rem; padding: 1.2rem; }
  h2 { margin: 0; font-size: 1.1rem; overflow-wrap: anywhere; }
  p { margin: 0; line-height: 1.5; }
  .field { display: grid; gap: 0.3rem; }
  .field span { color: var(--muted); font-size: 0.85rem; font-weight: 600; }
  select { min-height: 2.75rem; padding-left: 0.6rem; font: inherit; border: 1px solid var(--border); border-radius: 0.7rem; background-color: var(--surface); color: var(--text); }
  .check { display: flex; gap: 0.6rem; align-items: center; min-height: 2.75rem; }
  .check input { width: 1.2rem; height: 1.2rem; accent-color: var(--accent); }
  .buttons { display: flex; justify-content: flex-end; gap: 0.5rem; }
  .buttons button { min-height: 2.75rem; padding: 0 1.2rem; border: 0; border-radius: 1.4rem; font: inherit; font-weight: 700; }
  .cancel { background: none; color: var(--muted); }
  .confirm { background: var(--accent); color: var(--on-accent); }
  .confirm.danger { background: var(--danger-bg); color: var(--on-danger-bg); }
</style>
