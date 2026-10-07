<script lang="ts">
  import AtSign from '@lucide/svelte/icons/at-sign';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import Globe from '@lucide/svelte/icons/globe';
  import ImagePlus from '@lucide/svelte/icons/image-plus';
  import Languages from '@lucide/svelte/icons/languages';
  import Lock from '@lucide/svelte/icons/lock';
  import LockOpen from '@lucide/svelte/icons/lock-open';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
  import X from '@lucide/svelte/icons/x';
  import { untrack } from 'svelte';
  import { ApiError } from '../lib/api/client';
  import { updateMedia, uploadMedia, waitForProcessing } from '../lib/api/media';
  import { startLogin } from '../lib/api/oauth';
  import { getLimits, postStatus } from '../lib/api/statuses';
  import type { Visibility } from '../lib/api/types';
  import { canSend, defaultLanguage, defaultVisibility, LANGUAGES, mentionPrefix, missingAltText, pickImages, remaining } from '../lib/composeLogic';
  import { htmlToText } from '../lib/html';
  import { languageName, type MessageKey } from '../lib/i18n';
  import { accountStore } from '../lib/stores/accounts.svelte';
  import { composer } from '../lib/stores/composer.svelte';
  import { i18n, t } from '../lib/stores/i18n.svelte';
  import { toast } from '../lib/stores/toast.svelte';
  import AltTextDialog from './AltTextDialog.svelte';

  const VISIBILITIES: { value: Visibility; label: MessageKey }[] = [
    { value: 'public', label: 'compose.visibility.public' },
    { value: 'unlisted', label: 'compose.visibility.unlisted' },
    { value: 'private', label: 'compose.visibility.private' },
    { value: 'direct', label: 'compose.visibility.direct' },
  ];

  interface Attachment {
    key: string;
    file: File;
    /** Local preview (object URL), so nothing waits for the server */
    preview: string;
    state: 'uploading' | 'processing' | 'ready';
    /** The server's id for the file, set when the upload is accepted */
    id: string;
    description: string;
    /** The description the server has, to send only changes */
    savedDescription: string;
  }

  const LANGUAGE_KEY = 'compose-language';

  let dialog: HTMLDialogElement | undefined = $state();
  let textarea: HTMLTextAreaElement | undefined = $state();
  let fileInput: HTMLInputElement | undefined = $state();

  let text = $state('');
  let cwOn = $state(false);
  let cw = $state('');
  let visibility = $state<Visibility>('public');
  let language = $state('');
  let maxChars = $state(500);
  let maxMedia = $state(4);
  let altChars = $state(1500);
  let attachments = $state<Attachment[]>([]);
  let editing = $state<Attachment | null>(null);
  let altReminder = $state(false);
  /** Uploading needs the write:media scope, which an old login does not have */
  let needsReauth = $state(false);
  let dragging = $state(false);
  let busy = $state(false);
  let error = $state('');
  let prefix = '';
  // The same key on retries (no duplicate posts), a new key for every new form
  let idempotencyKey = '';

  const draft = $derived({ text, cwOn, cw, maxChars });
  const left = $derived(remaining(draft));
  const sendable = $derived(canSend(draft, prefix, attachments.length) && !busy && attachments.every((a) => a.state === 'ready'));
  const target = $derived(composer.replyTo ?? composer.quoting);
  const quote = $derived(target ? htmlToText(target.content).slice(0, 160) : '');

  function readSavedLanguage(): string | null {
    try {
      return localStorage.getItem(LANGUAGE_KEY);
    } catch {
      return null;
    }
  }

  function reset() {
    const replyTo = composer.replyTo;
    prefix = mentionPrefix(replyTo, accountStore.active?.acct ?? '');
    text = prefix;
    cwOn = false;
    cw = '';
    visibility = defaultVisibility(replyTo);
    language = defaultLanguage(readSavedLanguage(), navigator.language);
    error = '';
    busy = false;
    for (const a of attachments) URL.revokeObjectURL(a.preview);
    attachments = [];
    editing = null;
    altReminder = false;
    needsReauth = false;
    dragging = false;
    idempotencyKey = crypto.randomUUID();
    const client = accountStore.client();
    if (client) {
      getLimits(client).then((l) => {
        maxChars = l.maxChars;
        maxMedia = l.maxMedia;
        altChars = l.altChars;
      });
    }
  }

  const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

  function addFiles(files: Iterable<File>) {
    const client = accountStore.client();
    if (!client) return;
    const { accepted, overLimit } = pickImages(files, maxMedia - attachments.length);
    if (overLimit) error = t('compose.media.limit');
    for (const file of accepted) {
      attachments.push({ key: crypto.randomUUID(), file, preview: URL.createObjectURL(file), state: 'uploading', id: '', description: '', savedDescription: '' });
      upload(client, attachments[attachments.length - 1]);
    }
  }

  async function upload(client: NonNullable<ReturnType<typeof accountStore.client>>, item: Attachment) {
    try {
      let media = await uploadMedia(client, item.file);
      item.id = media.id;
      if (!media.url) {
        item.state = 'processing';
        media = await waitForProcessing(client, media);
      }
      item.state = 'ready';
    } catch (err) {
      if (!attachments.includes(item)) return; // removed or the form was reset meanwhile
      removeAttachment(item);
      if (err instanceof ApiError && err.status === 403) needsReauth = true;
      else error = errorText(err);
    }
  }

  function removeAttachment(item: Attachment) {
    URL.revokeObjectURL(item.preview);
    attachments = attachments.filter((a) => a !== item);
  }

  const reauth = () => accountStore.active && startLogin(accountStore.active.instance);

  function onFilesChosen() {
    if (fileInput?.files) addFiles(fileInput.files);
    if (fileInput) fileInput.value = '';
  }

  // A picture on the clipboard becomes an attachment; pasting text works as usual
  function onPaste(e: ClipboardEvent) {
    const files = [...(e.clipboardData?.files ?? [])];
    if (!files.some((f) => f.type.startsWith('image/')) || e.clipboardData?.getData('text/plain').trim()) return;
    e.preventDefault();
    addFiles(files);
  }

  const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files');

  function onDragOver(e: DragEvent) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragging = true;
  }

  function onDrop(e: DragEvent) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragging = false;
    addFiles(e.dataTransfer?.files ?? []);
  }

  function addAltText() {
    altReminder = false;
    editing = attachments.find((a) => a.description.trim() === '') ?? null;
  }

  // Open and close the native <dialog>: it takes care of focus and the Esc key
  $effect(() => {
    if (!dialog) return;
    if (composer.open && !dialog.open) {
      untrack(reset);
      dialog.showModal();
      textarea?.focus();
      textarea?.setSelectionRange(text.length, text.length);
    } else if (!composer.open && dialog.open) {
      dialog.close();
    }
  });

  const dirty = () => text.trim() !== prefix.trim() || cw.trim() !== '' || attachments.length > 0;

  function requestClose() {
    if (busy) return;
    if (dirty() && !confirm(t('compose.discard'))) return;
    composer.close();
  }

  async function submit(e?: Event, skipAltReminder = false) {
    e?.preventDefault();
    const client = accountStore.client();
    if (!sendable || !client) return;
    if (!skipAltReminder && missingAltText(attachments)) {
      altReminder = true;
      return;
    }
    altReminder = false;
    busy = true;
    error = '';
    try {
      for (const a of attachments) {
        if (a.description === a.savedDescription) continue;
        await updateMedia(client, a.id, a.description);
        a.savedDescription = a.description;
      }
      const posted = await postStatus(
        client,
        {
          status: text.trim(),
          visibility,
          ...(composer.replyTo ? { in_reply_to_id: composer.replyTo.id } : {}),
          ...(composer.quoting ? { quoted_status_id: composer.quoting.id } : {}),
          ...(cwOn ? { spoiler_text: cw.trim() } : {}),
          ...(language ? { language } : {}),
          ...(attachments.length ? { media_ids: attachments.map((a) => a.id) } : {}),
        },
        idempotencyKey,
      );
      try {
        localStorage.setItem(LANGUAGE_KEY, language);
      } catch {
        /* storage unavailable */
      }
      if (composer.replyTo) composer.replyTo.replies_count += 1;
      composer.posted();
      if (composer.quoting) {
        if (composer.quoting.quotes_count !== undefined) composer.quoting.quotes_count += 1;
        // A quote that needs the author's approval is not shown until it is given
        toast.show(posted?.quote?.state === 'pending' ? t('compose.quotePending') : t('compose.published'), 'info');
      } else toast.show(t('compose.published'), 'info');
      composer.close();
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      busy = false;
    }
  }

  // A click outside the form (on the backdrop) closes it. The press must also have started on the
  // backdrop, so selecting text in the form and releasing over the backdrop does not close it by accident.
  let downOnBackdrop = false;

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e);
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog
  bind:this={dialog}
  aria-labelledby="compose-title"
  onmousedown={(e) => (downOnBackdrop = e.target === dialog)}
  onclick={(e) => {
    if (downOnBackdrop && e.target === dialog) requestClose();
    downOnBackdrop = false;
  }}
  oncancel={(e) => {
    e.preventDefault();
    requestClose();
  }}
  ondragover={onDragOver}
  ondragleave={(e) => {
    if (e.target === dialog) dragging = false;
  }}
  ondrop={onDrop}
>
  <form onsubmit={submit}>
    <header>
      <button type="button" class="cancel" onclick={requestClose}>{t('common.cancel')}</button>
      <h2 id="compose-title">{composer.replyTo ? t('compose.titleReply') : composer.quoting ? t('compose.titleQuote') : t('compose.titleNew')}</h2>
      <button type="submit" class="send" disabled={!sendable}>{busy ? t('compose.publishing') : t('compose.publish')}</button>
    </header>

    {#if target}
      <p class="quote">
        <strong>@{target.account.acct}</strong>
        {quote}
      </p>
    {/if}

    <div class="editor">
      {#if accountStore.active?.avatar}
        <img class="me" src={accountStore.active.avatar} alt="" width="44" height="44" />
      {:else}
        <span class="me initial" aria-hidden="true">{accountStore.active?.displayName.charAt(0).toUpperCase() || '?'}</span>
      {/if}
      <div class="fields">
        {#if cwOn}
          <input
            class="cw"
            type="text"
            bind:value={cw}
            placeholder={t('compose.cw')}
            aria-label={t('compose.cw')}
            autocomplete="off"
          />
        {/if}
        <textarea
          bind:this={textarea}
          bind:value={text}
          onkeydown={onKeydown}
          onpaste={onPaste}
          rows="6"
          aria-label={t('compose.placeholder')}
          placeholder={t('compose.placeholder')}
        ></textarea>
      </div>
    </div>

    {#if attachments.length}
      <ul class="media">
        {#each attachments as a (a.key)}
          <li>
            <img src={a.preview} alt={a.description} />
            {#if a.state !== 'ready'}
              <span class="progress">{a.state === 'uploading' ? t('compose.media.uploading') : t('compose.media.processing')}</span>
            {/if}
            <button
              type="button"
              class="alt"
              class:set={a.description.trim() !== ''}
              aria-label={t('compose.media.edit')}
              title={t('compose.media.altBadge')}
              onclick={() => (editing = a)}
            >ALT</button>
            <button type="button" class="remove" aria-label={t('compose.media.remove')} title={t('compose.media.remove')} onclick={() => removeAttachment(a)}>
              <X size={18} aria-hidden="true" />
            </button>
          </li>
        {/each}
      </ul>
    {/if}

    {#if altReminder}
      <div class="reminder" role="group" aria-labelledby="alt-reminder-title">
        <strong id="alt-reminder-title">{t('compose.altReminder.title')}</strong>
        <p>{t('compose.altReminder.message')}</p>
        <div class="actions">
          <button type="button" class="primary" onclick={addAltText}>{t('compose.altReminder.add')}</button>
          <button type="button" onclick={() => submit(undefined, true)}>{t('compose.altReminder.postAnyway')}</button>
        </div>
      </div>
    {/if}

    <div class="tools">
      <input bind:this={fileInput} type="file" accept="image/*" multiple hidden onchange={onFilesChosen} />
      <button
        type="button"
        class="tool"
        aria-label={t('compose.media.add')}
        title={t('compose.media.add')}
        disabled={attachments.length >= maxMedia}
        onclick={() => fileInput?.click()}
      ><ImagePlus size={20} aria-hidden="true" /></button>
      <!-- Icon-only controls: the native <select> sits invisibly on top, so it keeps its accessible name and its picker -->
      <label class="tool">
        {#if visibility === 'public'}<Globe size={20} aria-hidden="true" />
        {:else if visibility === 'unlisted'}<LockOpen size={20} aria-hidden="true" />
        {:else if visibility === 'private'}<Lock size={20} aria-hidden="true" />
        {:else}<AtSign size={20} aria-hidden="true" />{/if}
        <ChevronDown size={14} aria-hidden="true" />
        <select bind:value={visibility} aria-label={t('compose.visibility')} title={t('compose.visibility')}>
          {#each VISIBILITIES as v (v.value)}
            <option value={v.value}>{t(v.label)}</option>
          {/each}
        </select>
      </label>
      <label class="tool">
        <Languages size={20} aria-hidden="true" />
        <span class="code" aria-hidden="true">{language || '–'}</span>
        <select bind:value={language} aria-label={t('compose.language')} title={t('compose.language')}>
          <option value="">{t('compose.languageDefault')}</option>
          {#each LANGUAGES as code (code)}
            <option value={code}>{languageName(code, i18n.locale)}</option>
          {/each}
        </select>
      </label>
      <button
        type="button"
        class="tool cwtoggle"
        class:on={cwOn}
        aria-pressed={cwOn}
        aria-label={t('compose.cw')}
        title={t('compose.cw')}
        onclick={() => (cwOn = !cwOn)}
      ><TriangleAlert size={20} aria-hidden="true" /></button>
      <span class="count" class:over={left < 0} aria-live="polite">{maxChars - left} / {maxChars}</span>
    </div>

    {#if needsReauth}
      <p class="error" role="alert">
        {t('compose.media.reauth')}
        <button type="button" class="relogin" onclick={reauth}>{t('profile.reauthButton')}</button>
      </p>
    {/if}
    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}
  </form>
  {#if dragging}
    <div class="drop" aria-hidden="true">{t('compose.media.drop')}</div>
  {/if}
</dialog>

{#if editing}
  <AltTextDialog
    preview={editing.preview}
    description={editing.description}
    limit={altChars}
    onDone={(description) => {
      if (editing) editing.description = description;
      editing = null;
    }}
    onCancel={() => (editing = null)}
  />
{/if}

<style>
  /* Bottom sheet: rises from the bottom edge of the screen */
  dialog {
    width: min(40rem, 100vw);
    max-width: 100vw;
    height: calc(100dvh - 4rem);
    max-height: 46rem;
    margin: auto auto 0;
    padding: 0;
    border: 1px solid var(--border);
    border-bottom: 0;
    border-radius: 1.4rem 1.4rem 0 0;
    background: var(--bg);
    color: var(--text);
  }
  dialog[open] { display: flex; flex-direction: column; }
  /* On a phone the editor fills the screen; its height follows the visible area (see the viewport meta), so the
     keyboard never covers the tools at the bottom */
  @media (max-width: 40rem) {
    dialog { width: 100vw; height: 100dvh; max-height: none; margin: 0; border: 0; border-radius: 0; }
  }
  dialog::backdrop { background: rgb(0 0 0 / 0.55); }
  form { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 0.6rem; padding: 0.6rem 1rem calc(1rem + env(safe-area-inset-bottom)); }
  header { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
  h2 { margin: 0; font-size: 1.05rem; }
  .cancel { min-height: 2.75rem; padding: 0 0.6rem; border: 0; background: none; color: var(--muted); font-weight: 500; font-size: 1rem; margin-left: -0.6rem; }
  .send { height: 2.75rem; padding: 0 1.3rem; border: 0; border-radius: 1.4rem; background: var(--accent); color: var(--on-accent); font-weight: 700; font-size: 1rem; }
  .send:disabled { opacity: 0.5; cursor: default; }
  .quote { margin: 0; padding: 0.5rem 0.7rem; border-left: 3px solid var(--accent); background: var(--surface); border-radius: 0.3rem; color: var(--muted); font-size: 0.9rem; overflow-wrap: anywhere; }
  .quote strong { color: var(--text); }
  .editor { flex: 1; min-height: 0; display: flex; gap: 0.75rem; }
  .me { width: 2.75rem; height: 2.75rem; border-radius: var(--radius-avatar); flex: none; }
  img.me { border: var(--avatar-border); }
  .initial { display: inline-flex; align-items: center; justify-content: center; background: var(--accent); color: var(--on-accent); font-weight: 700; }
  .fields { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.6rem; }
  textarea, input.cw, select {
    font: inherit; border: 1px solid var(--border); background: var(--surface); color: var(--text);
  }
  input.cw { min-height: 2.75rem; padding: 0 0.9rem; border-radius: 0.7rem; border: 1px dashed var(--marker); }
  textarea { flex: 1; width: 100%; box-sizing: border-box; min-height: 6rem; padding: 0.2rem 0; border: 0; background: none; font-size: 1.15rem; line-height: 1.5; resize: none; outline: none; }
  .tools { display: flex; align-items: center; gap: 0.25rem; padding-top: 0.4rem; border-top: 1px solid var(--border); }
  .tool { position: relative; flex: none; display: inline-flex; align-items: center; justify-content: center; gap: 0.2rem; min-width: 2.75rem; height: 2.75rem; padding: 0 0.5rem; box-sizing: border-box; border: 1px solid transparent; border-radius: 0.75rem; background: none; color: var(--muted); font: inherit; cursor: pointer; }
  .tool:hover, .tool:focus-within { background: var(--surface); color: var(--text); }
  .tool .code { font-size: 0.8rem; font-weight: 700; text-transform: uppercase; }
  /* The select covers the whole control but is invisible: tapping it opens the native picker */
  .tool select { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; font-size: 1rem; }
  .cwtoggle.on { border-color: var(--marker); color: var(--marker); }
  .tools .count { flex: none; margin-left: auto; color: var(--muted); font-weight: 600; font-size: 0.9rem; font-variant-numeric: tabular-nums; }
  .tools .count.over { color: var(--danger); font-weight: 700; }
  .error { margin: 0; color: var(--danger); }
  .relogin { min-height: 2.75rem; padding: 0 0.9rem; border: 1px solid var(--border); border-radius: 0.75rem; background: var(--surface); color: var(--text); font: inherit; }
  .tool:disabled { opacity: 0.4; cursor: default; }
  .media { display: flex; gap: 0.5rem; margin: 0; padding: 0; list-style: none; overflow-x: auto; }
  .media li { position: relative; flex: none; width: 7rem; height: 7rem; }
  .media img { width: 100%; height: 100%; object-fit: cover; border-radius: 0.7rem; border: 1px solid var(--border); }
  .progress { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 0.3rem; border-radius: 0.7rem; background: rgb(0 0 0 / 0.55); color: #fff; font-size: 0.85rem; font-weight: 600; text-align: center; }
  .alt { position: absolute; left: 0.3rem; bottom: 0.3rem; min-width: 2.75rem; min-height: 2.75rem; padding: 0 0.5rem; border: 1px dashed var(--marker); border-radius: 0.6rem; background: rgb(0 0 0 / 0.7); color: #fff; font: inherit; font-size: 0.8rem; font-weight: 700; }
  .alt.set { border-style: solid; border-color: var(--accent); background: var(--accent); color: var(--on-accent); }
  .remove { position: absolute; top: 0.2rem; right: 0.2rem; display: inline-flex; align-items: center; justify-content: center; width: 2.75rem; height: 2.75rem; padding: 0; border: 0; border-radius: 50%; background: none; color: #fff; }
  .remove :global(svg) { box-sizing: content-box; padding: 0.3rem; border-radius: 50%; background: rgb(0 0 0 / 0.7); }
  .reminder { padding: 0.7rem 0.9rem; border: 1px solid var(--marker); border-radius: 0.7rem; background: var(--surface); }
  .reminder p { margin: 0.3rem 0 0.6rem; color: var(--muted); font-size: 0.95rem; }
  .reminder .actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .reminder button { min-height: 2.75rem; padding: 0 1rem; border: 1px solid var(--border); border-radius: 1.4rem; background: none; color: var(--text); font: inherit; font-weight: 600; }
  .reminder button.primary { border-color: var(--accent); background: var(--accent); color: var(--on-accent); }
  .drop { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; border: 3px dashed var(--accent); border-radius: inherit; background: rgb(0 0 0 / 0.6); color: #fff; font-weight: 700; font-size: 1.1rem; pointer-events: none; }
</style>
