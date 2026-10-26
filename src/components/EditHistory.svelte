<script lang="ts">
  import { getContext } from 'svelte';
  import type { MastodonClient } from '../lib/api/client';
  import { getStatusHistory } from '../lib/api/statuses';
  import type { StatusVersion } from '../lib/api/types';
  import { sanitizeContent, sanitizeText } from '../lib/html';
  import { formatDateTime } from '../lib/i18n';
  import { i18n, t } from '../lib/stores/i18n.svelte';
  import { safeHttpUrl } from '../lib/url';

  let { id, onClose }: { id: string; onClose: () => void } = $props();

  const client = getContext<MastodonClient>('mastodon-client');

  let dialog: HTMLDialogElement | undefined = $state();
  let versions = $state<StatusVersion[] | null>(null);
  let error = $state('');

  $effect(() => {
    if (dialog && !dialog.open) dialog.showModal();
  });

  // The server lists the oldest first; the newest is the one to see first
  $effect(() => {
    getStatusHistory(client, id).then(
      (list) => (versions = list.toReversed()),
      (e) => (error = t('action.failed', { message: e instanceof Error ? e.message : String(e) })),
    );
  });

  const heading = (v: StatusVersion, i: number) => t(i === versions!.length - 1 ? 'status.versionCreated' : 'status.versionEdited', { name: v.account.display_name || v.account.username, date: formatDateTime(v.created_at, i18n.locale) });
</script>

<dialog bind:this={dialog} aria-labelledby="history-title" oncancel={(e) => { e.preventDefault(); onClose(); }} onclick={(e) => e.target === dialog && onClose()}>
  <div class="box">
    <h2 id="history-title">{t('status.versions')}</h2>
    {#if error}
      <p class="error" role="alert">{error}</p>
    {:else if !versions}
      <p class="muted">{t('common.loading')}</p>
    {:else}
      <ol>
        {#each versions as v, i (v.created_at)}
          <li>
            <h3>{heading(v, i)}</h3>
            {#if v.spoiler_text}<p class="cw">{@html sanitizeText(v.spoiler_text, v.emojis)}</p>{/if}
            <div class="content">{@html sanitizeContent(v.content, v.emojis)}</div>
            {#if v.media_attachments.length}
              <ul class="media" class:blur={v.sensitive}>
                {#each v.media_attachments as m (m.id)}
                  {@const preview = safeHttpUrl(m.preview_url)}
                  {#if preview}<li><img src={preview} alt={m.description ?? ''} loading="lazy" /></li>{/if}
                {/each}
              </ul>
            {/if}
            {#if v.poll}
              <ul class="poll">
                {#each v.poll.options as o}<li>{o.title}</li>{/each}
              </ul>
            {/if}
          </li>
        {/each}
      </ol>
    {/if}
    <div class="buttons"><button type="button" onclick={onClose}>{t('common.close')}</button></div>
  </div>
</dialog>

<style>
  dialog { width: min(34rem, calc(100vw - 2rem)); max-height: calc(100dvh - 2rem); padding: 0; border: 1px solid var(--border); border-radius: 1.2rem; background: var(--bg); color: var(--text); }
  dialog::backdrop { background: rgb(0 0 0 / 0.55); }
  .box { display: flex; flex-direction: column; gap: 0.9rem; padding: 1.2rem; }
  h2 { margin: 0; font-size: 1.1rem; }
  ol { display: flex; flex-direction: column; gap: 1rem; margin: 0; padding: 0; list-style: none; }
  /* The line down the left shows the order of the versions */
  ol > li { padding-left: 0.8rem; border-left: 2px solid var(--border); }
  h3 { margin: 0 0 0.3rem; color: var(--muted); font-size: 0.85rem; font-weight: 600; }
  .cw { margin: 0 0 0.3rem; font-weight: 600; }
  .content { overflow-wrap: anywhere; }
  .content :global(p) { margin: 0 0 0.5rem; }
  .media { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.4rem 0 0; padding: 0; list-style: none; }
  .media img { display: block; width: 5rem; height: 5rem; object-fit: cover; border-radius: 0.5rem; }
  .media.blur img { filter: blur(12px); }
  .poll { margin: 0.4rem 0 0; padding-left: 1.2rem; color: var(--muted); }
  .muted { margin: 0; color: var(--muted); }
  .error { margin: 0; color: var(--danger); }
  .buttons { display: flex; justify-content: flex-end; }
  .buttons button { min-height: 2.75rem; padding: 0 1.2rem; border: 0; border-radius: 1.4rem; background: var(--accent); color: var(--on-accent); font: inherit; font-weight: 700; }
</style>
