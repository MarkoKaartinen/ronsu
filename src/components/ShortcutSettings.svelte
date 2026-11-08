<script lang="ts">
  import { onDestroy } from 'svelte';
  import { CHORD_MS, DEFAULT_BINDINGS, keyName, SHORTCUT_ACTIONS, type ShortcutGroup, type ShortcutId } from '../lib/shortcuts';
  import { t } from '../lib/stores/i18n.svelte';
  import { shortcutStore } from '../lib/stores/shortcuts.svelte';
  import ShortcutKeys from './ShortcutKeys.svelte';

  const GROUPS: ShortcutGroup[] = ['posts', 'feed', 'go'];

  /** A touch screen has no keyboard to speak of: the section is for a mouse and a keyboard */
  const keyboard = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /** The action waiting for a key, the keys pressed so far, and the message about a taken key */
  let recording = $state<ShortcutId | null>(null);
  let keys = $state<string[]>([]);
  let conflict = $state<{ id: ShortcutId; with: ShortcutId } | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;

  function stop() {
    clearTimeout(timer);
    recording = null;
    keys = [];
    shortcutStore.recording = false;
  }

  function start(id: ShortcutId) {
    stop();
    conflict = null;
    recording = id;
    shortcutStore.recording = true;
  }

  /** One key, or two in a row within a moment, makes the binding; the second key is optional, so the first one waits for it */
  function commit() {
    const id = recording;
    const binding = keys.join(' ');
    stop();
    if (!id) return;
    const other = shortcutStore.set(id, binding);
    conflict = other ? { id, with: other } : null;
  }

  function onKeydown(e: KeyboardEvent, id: ShortcutId) {
    if (recording !== id) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      stop();
      return;
    }
    const key = keyName(e);
    // A modifier alone is the start of a key combination; Tab leaves the button
    if (key === null) return;
    e.preventDefault();
    clearTimeout(timer);
    keys = [...keys, key];
    if (keys.length === 2) commit();
    else timer = setTimeout(commit, CHORD_MS);
  }

  function clear(id: ShortcutId) {
    conflict = null;
    shortcutStore.set(id, '');
  }

  function reset(id: ShortcutId) {
    conflict = null;
    shortcutStore.reset(id);
  }

  const changed = $derived(SHORTCUT_ACTIONS.some((a) => shortcutStore.bindings[a.id] !== a.default));

  onDestroy(stop);
</script>

{#if keyboard}
  <section>
    <h2>{t('shortcuts.settings')}</h2>
    <p class="intro">{t('shortcuts.intro')}</p>

    {#each GROUPS as group (group)}
      <h3>{t(`shortcuts.group.${group}`)}</h3>
      <ul>
        {#each SHORTCUT_ACTIONS.filter((a) => a.group === group) as a (a.id)}
          <li>
            <span class="name">{t(`shortcut.${a.id}`)}</span>
            <button
              class="key"
              class:recording={recording === a.id}
              data-shortcut={a.id}
              aria-label="{t(`shortcut.${a.id}`)}: {t('shortcuts.change')}"
              onclick={() => start(a.id)}
              onkeydown={(e) => onKeydown(e, a.id)}
              onblur={() => recording === a.id && stop()}
            >
              {#if recording === a.id}
                {keys.length ? keys.join(' ') + '…' : t('shortcuts.press')}
              {:else}
                <ShortcutKeys binding={shortcutStore.bindings[a.id]} />
              {/if}
            </button>
            <button class="small" onclick={() => clear(a.id)} disabled={shortcutStore.bindings[a.id] === ''}>{t('shortcuts.clear')}</button>
            <button class="small" onclick={() => reset(a.id)} disabled={shortcutStore.bindings[a.id] === DEFAULT_BINDINGS[a.id]}>{t('shortcuts.reset')}</button>
          </li>
          {#if conflict?.id === a.id}
            <li class="conflict" role="alert">{t('shortcuts.taken', { action: t(`shortcut.${conflict.with}`) })}</li>
          {/if}
        {/each}
      </ul>
    {/each}

    <button class="all" onclick={() => { conflict = null; shortcutStore.resetAll(); }} disabled={!changed}>{t('shortcuts.resetAll')}</button>
  </section>
{/if}

<style>
  h2 { margin: 0 0 0.6rem; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
  h3 { margin: 1rem 0 0.3rem; font-size: 0.85rem; color: var(--muted); }
  .intro { margin: 0; color: var(--muted); font-size: 0.9rem; }
  ul { list-style: none; margin: 0; padding: 0; }
  li { display: flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0; border-bottom: 1px solid var(--border); }
  .name { flex: 1; min-width: 0; }
  .key { min-width: 6rem; min-height: 2.25rem; padding: 0.2rem 0.6rem; border: 1px solid var(--border); border-radius: 0.5rem; background: var(--surface); color: var(--text); }
  .key.recording { border-color: var(--accent); color: var(--accent); font-weight: 600; }
  .small, .all { min-height: 2.25rem; padding: 0.2rem 0.7rem; border: 1px solid var(--border); border-radius: 0.5rem; background: none; color: var(--text); font-size: 0.85rem; }
  .small:disabled, .all:disabled { opacity: 0.45; }
  .conflict { color: var(--danger); font-size: 0.9rem; border-bottom: 0; padding-top: 0; }
  .all { margin-top: 1rem; }
</style>
