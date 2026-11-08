<script lang="ts">
  import X from '@lucide/svelte/icons/x';
  import { onDestroy } from 'svelte';
  import { router } from '../lib/router.svelte';
  import { CHORD_MS, keyName, matchKey, SHORTCUT_ACTIONS, type ShortcutGroup, type ShortcutId } from '../lib/shortcuts';
  import { composer } from '../lib/stores/composer.svelte';
  import { t } from '../lib/stores/i18n.svelte';
  import { lightbox } from '../lib/stores/lightbox.svelte';
  import { shortcutStore } from '../lib/stores/shortcuts.svelte';
  import ShortcutKeys from './ShortcutKeys.svelte';

  const ARTICLE = 'article[data-id]';
  /** Space kept between the bars at the top and the post the shortcut scrolled to */
  const SCROLL_GAP_PX = 8;
  /** Room under a button scrolled to, for the bottom bar of a phone that covers the lower edge of the page */
  const BOTTOM_BAR_PX = 72;
  /** Sticky bars that cover the top of the page or of the notifications column */
  const STICKY_BARS = '.bar, .refresh, header.top';

  let pending: string[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let help: HTMLDialogElement | undefined = $state();

  const visible = (el: Element) => !el.closest('[hidden], [inert]');

  /** The post the reader is on: the one with the focus, or the one the focus is inside of */
  const focusedPost = () => document.activeElement?.closest<HTMLElement>(ARTICLE) ?? null;

  /**
   * Where the shortcuts act: the column of the focused post (the notifications beside the feed are a column of their
   * own), otherwise the reading column
   */
  const scopeOf = (post: Element | null): ParentNode => post?.closest('aside, .shell') ?? document.querySelector('.shell') ?? document;

  const postsIn = (scope: ParentNode) => [...scope.querySelectorAll<HTMLElement>(ARTICLE)].filter(visible);

  /** The bottom edge of what covers the top of the column: a post scrolled to must stop below it */
  function topEdge(scope: ParentNode): number {
    let edge = 0;
    for (const bar of scope.querySelectorAll<HTMLElement>(STICKY_BARS)) {
      if (!visible(bar) || getComputedStyle(bar).position !== 'sticky') continue;
      const r = bar.getBoundingClientRect();
      if (r.height > 0 && r.top < innerHeight / 2) edge = Math.max(edge, r.bottom);
    }
    return edge;
  }

  function goTo(post: HTMLElement, scope: ParentNode) {
    post.focus({ preventScroll: true });
    post.style.scrollMarginTop = `${topEdge(scope) + SCROLL_GAP_PX}px`;
    post.scrollIntoView({ block: 'start' });
  }

  /** The first post on screen, where the reader is when nothing has been chosen yet */
  function firstOnScreen(posts: HTMLElement[], scope: ParentNode): HTMLElement | undefined {
    const edge = topEdge(scope);
    return posts.find((p) => p.getBoundingClientRect().bottom > edge) ?? posts[0];
  }

  /**
   * At the first or the last post there is nothing further to go to: the load button beyond it is brought into view,
   * so the reader sees how to get more (the buttons are above the first post and below the last one)
   */
  function revealEdgeButton(posts: HTMLElement[], scope: ParentNode, delta: 1 | -1) {
    const edge = delta === 1 ? posts.at(-1) : posts[0];
    if (!edge) return;
    // The flag tells where the button is in relation to the post: below it follows it, above it precedes it
    const wanted = delta === 1 ? Node.DOCUMENT_POSITION_FOLLOWING : Node.DOCUMENT_POSITION_PRECEDING;
    const buttons = [...scope.querySelectorAll<HTMLElement>('[data-action^="load-"]')].filter((b) => visible(b) && edge.compareDocumentPosition(b) & wanted);
    // The nearest one to the post: the last of those above it, the first of those below it
    const button = delta === 1 ? buttons[0] : buttons.at(-1);
    if (!button) return;
    button.style.scrollMarginTop = `${topEdge(scope) + SCROLL_GAP_PX}px`;
    button.style.scrollMarginBottom = `${BOTTOM_BAR_PX}px`;
    button.scrollIntoView({ block: delta === 1 ? 'end' : 'start' });
  }

  /** Down is down the screen, whether the oldest or the newest post is first (newest first, down is an older post) */
  function move(delta: 1 | -1) {
    const current = focusedPost();
    const scope = scopeOf(current);
    const posts = postsIn(scope);
    const i = current ? posts.indexOf(current) : -1;
    const next = i === -1 ? firstOnScreen(posts, scope) : posts[i + delta];
    if (next) goTo(next, scope);
    else if (i !== -1) revealEdgeButton(posts, scope, delta);
  }

  /** Presses a control of the focused post (the same code as a click, so a failed request is rolled back and told as usual) */
  function press(selector: string) {
    const post = focusedPost();
    const el = post?.querySelector<HTMLElement>(selector);
    if (el && !el.closest('[inert]')) el.click();
  }

  /** The button of the column the reader is in, if the column has one ("Load more" and the like) */
  function pressInColumn(name: string) {
    const scope = scopeOf(focusedPost());
    const el = [...scope.querySelectorAll<HTMLElement>(`[data-action="${name}"]`)].find(visible);
    el?.click();
  }

  const GO: Partial<Record<ShortcutId, () => void>> = {
    goHome: () => router.openTab('home'),
    goNotifications: () => router.openTab('notifications'),
    goMessages: () => router.openTab('messages'),
    goFavourites: () => router.openSaved('favourites'),
    goBookmarks: () => router.openSaved('bookmarks'),
    goSettings: () => router.openSettings(),
  };

  function run(action: ShortcutId) {
    switch (action) {
      case 'down': return move(1);
      case 'up': return move(-1);
      case 'reply': return press('[data-action="reply"]');
      case 'boost': return press('[data-action="reblog"]');
      case 'favourite': return press('[data-action="favourite"]');
      case 'bookmark': return press('[data-action="bookmark"]');
      case 'quote': return press('[data-action="quote"]');
      case 'openThread': return focusedPost()?.click();
      case 'openProfile': return press('[data-action="profile"]');
      case 'openMedia': return press('[data-action="open-media"]');
      case 'toggleWarning': return press('[data-action="toggle-warning"]');
      case 'toggleMedia': return press('[data-action="reveal-media"]');
      case 'loadNew': return pressInColumn('load-new');
      case 'loadOlder': return pressInColumn('load-older');
      case 'newPost': return composer.show();
      case 'back': return ['thread', 'profile', 'tag'].includes(router.route.name) ? router.back() : undefined;
      case 'help': return void (shortcutStore.helpOpen = true);
      default: return GO[action]?.();
    }
  }

  const TYPING = 'input, textarea, select, [contenteditable]';

  function onKeydown(e: KeyboardEvent) {
    if (e.defaultPrevented || shortcutStore.recording || composer.open || lightbox.open) return;
    // A dialog (a question before a block, the edit history, the help) has the keyboard to itself
    if (document.querySelector('dialog[open]')) return;
    const key = keyName(e);
    if (key === null) return;
    const target = e.target as Element | null;
    if (target?.closest(TYPING)) return;
    // Enter and the space bar press the focused button or link; they stay theirs
    if ((key === 'Enter' || key === 'Space') && target?.closest('a, button, summary')) return;

    const match = matchKey(shortcutStore.bindings, pending, key);
    clearTimeout(timer);
    pending = match.pending;
    if (pending.length) timer = setTimeout(() => (pending = []), CHORD_MS);
    if (!match.action) return;
    e.preventDefault();
    run(match.action);
  }

  // The native dialog takes care of the focus and the Esc key; the store only tells when it is wanted
  $effect(() => {
    if (!help) return;
    if (shortcutStore.helpOpen && !help.open) help.showModal();
    else if (!shortcutStore.helpOpen && help.open) help.close();
  });

  onDestroy(() => clearTimeout(timer));

  const GROUPS: ShortcutGroup[] = ['posts', 'feed', 'go'];
</script>

<svelte:window onkeydown={onKeydown} />

<dialog bind:this={help} class="help" aria-labelledby="shortcuts-title" onclose={() => (shortcutStore.helpOpen = false)} onclick={(e) => e.target === help && help?.close()}>
  <header>
    <h2 id="shortcuts-title">{t('shortcuts.title')}</h2>
    <button class="close" onclick={() => help?.close()} aria-label={t('common.close')}><X size={20} aria-hidden="true" /></button>
  </header>
  {#each GROUPS as group (group)}
    <h3>{t(`shortcuts.group.${group}`)}</h3>
    <dl>
      {#each SHORTCUT_ACTIONS.filter((a) => a.group === group) as a (a.id)}
        <dt><ShortcutKeys binding={shortcutStore.bindings[a.id]} /></dt>
        <dd>{t(`shortcut.${a.id}`)}</dd>
      {/each}
    </dl>
  {/each}
  <p class="hint"><button class="link" onclick={() => { help?.close(); router.openSettings(); }}>{t('shortcuts.change')}</button></p>
</dialog>

<style>
  .help { width: min(30rem, calc(100vw - 2rem)); max-height: calc(100dvh - 3rem); box-sizing: border-box; padding: 1rem 1.2rem 1.2rem; border: 1px solid var(--border); border-radius: 0.9rem; background: var(--bg); color: var(--text); }
  .help::backdrop { background: rgb(0 0 0 / 0.5); }
  header { display: flex; align-items: center; justify-content: space-between; }
  h2 { margin: 0; font-size: 1.1rem; }
  h3 { margin: 1.1rem 0 0.4rem; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
  .close { display: inline-flex; padding: 0.4rem; border: 0; background: none; color: inherit; border-radius: 0.5rem; }
  dl { display: grid; grid-template-columns: 7rem 1fr; gap: 0.35rem 0.8rem; margin: 0; align-items: center; }
  dt { margin: 0; }
  dd { margin: 0; }
  .hint { margin: 1.2rem 0 0; }
  .link { padding: 0; border: 0; background: none; color: var(--accent); font: inherit; text-decoration: underline; }
</style>
