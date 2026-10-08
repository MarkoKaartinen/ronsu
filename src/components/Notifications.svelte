<script lang="ts">
  import ChartBar from '@lucide/svelte/icons/chart-bar';
  import Heart from '@lucide/svelte/icons/heart';
  import Pencil from '@lucide/svelte/icons/pencil';
  import Repeat2 from '@lucide/svelte/icons/repeat-2';
  import UserCheck from '@lucide/svelte/icons/user-check';
  import UserPlus from '@lucide/svelte/icons/user-plus';
  import { setContext, tick, untrack } from 'svelte';
  import type { MastodonClient } from '../lib/api/client';
  import type { Account, Notification } from '../lib/api/types';
  import { sanitizeText } from '../lib/html';
  import { formatRelativeTime } from '../lib/i18n';
  import { profileHref, router } from '../lib/router.svelte';
  import { i18n, t } from '../lib/stores/i18n.svelte';
  import StatusCard from './StatusCard.svelte';

  // active=false: stays mounted, hidden, while the other main view, a thread or a profile is open
  let { client, active = true }: { client: MastodonClient; active?: boolean } = $props();

  // The action buttons (reply, favorite, ...) use the same client
  // svelte-ignore state_referenced_locally
  setContext('mastodon-client', client);

  const PAGE = 30;
  /**
   * The types that are shown. Mentions (and quotes, new posts of someone you follow) are posts of their own and
   * can be answered here; the others are a line saying what happened, with the post it was about.
   */
  const SHOWN = new Set(['mention', 'status', 'quote', 'reblog', 'favourite', 'follow', 'follow_request', 'poll', 'update']);
  const WITH_LINE = new Set(['reblog', 'favourite', 'poll', 'update']);
  /** A boost or a favorite is only a line and a short excerpt of your post; the others show the post with its buttons */
  const LIGHT = new Set(['reblog', 'favourite']);

  let items = $state<Notification[]>([]);
  let loading = $state(false);
  let error = $state('');
  let end = $state(false);
  let root: HTMLElement | undefined = $state();
  /** The id of the oldest notification received so far, whether it is shown or not (the next page starts there) */
  let cursor: string | undefined;
  /** All of them, or only the mentions (the server filters, so the pages are full of mentions) */
  let filter = $state<'all' | 'mentions'>('all');
  /** Increases when the filter changes: an answer to the previous filter's request is thrown away */
  let generation = 0;
  let loadedAt = 0;

  const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

  /** Fetches the newest page. If it does not connect to what is listed, the list starts again from it (no gap). */
  const params = (extra: Record<string, string | number | undefined> = {}) => ({
    limit: PAGE,
    ...(filter === 'mentions' ? { 'types[]': 'mention' } : {}),
    ...extra,
  });

  async function refresh() {
    if (loading) return;
    const gen = generation;
    loading = true;
    error = '';
    try {
      const page = await client.getPage<Notification>('/api/v1/notifications', params());
      if (gen !== generation) return;
      const known = new Set(items.map((n) => n.id));
      const connects = page.items.some((n) => known.has(n.id));
      const fresh = page.items.filter((n) => SHOWN.has(n.type) && !known.has(n.id));
      if (!items.length || !connects) {
        items = page.items.filter((n) => SHOWN.has(n.type));
        cursor = page.items.at(-1)?.id;
        end = page.items.length === 0;
      } else {
        items = [...fresh, ...items];
      }
      loadedAt = Date.now();
    } catch (e) {
      if (gen === generation) error = errorText(e);
    } finally {
      if (gen === generation) loading = false;
    }
  }

  async function loadMore() {
    if (loading || end || !cursor) return;
    error = '';
    const gen = generation;
    loading = true;
    try {
      const page = await client.getPage<Notification>('/api/v1/notifications', params({ max_id: cursor }));
      if (gen !== generation) return;
      if (page.items.length === 0) {
        end = true;
      } else {
        cursor = page.items.at(-1)!.id;
        // Never list the same one twice (a duplicate key would crash the keyed list)
        const known = new Set(items.map((n) => n.id));
        items.push(...page.items.filter((n) => SHOWN.has(n.type) && !known.has(n.id)));
      }
    } catch (e) {
      if (gen === generation) error = errorText(e);
    } finally {
      if (gen === generation) loading = false;
    }
  }

  function setFilter(next: 'all' | 'mentions') {
    if (next === filter) return;
    filter = next;
    generation++;
    items = [];
    cursor = undefined;
    end = false;
    error = '';
    loading = false;
    // To the top of whatever scrolls: the second column on a wide screen, the page otherwise
    const column = root?.closest('.aside');
    if (column) column.scrollTo(0, 0);
    else window.scrollTo(0, 0);
    refresh();
  }

  // Nothing is fetched by itself after the first time: the newest only with "Load new", older ones with "Load older"
  $effect(() => {
    if (active && loadedAt === 0) untrack(refresh);
  });

  /**
   * "Load new": the new ones go to the top of the list. If the reader has scrolled down, what is on screen is kept
   * at the same place (the first row is measured, as in the feed), so the list does not move under them.
   */
  async function reload() {
    const column = root?.closest('.aside');
    const scrolled = column ? column.scrollTop > 40 : window.scrollY > 40;
    const anchor = root?.querySelector<HTMLElement>('.list')?.firstElementChild as HTMLElement | null | undefined;
    const before = anchor?.getBoundingClientRect().top;
    await refresh();
    await tick();
    if (!scrolled || !anchor?.isConnected || before === undefined) return;
    const moved = anchor.getBoundingClientRect().top - before;
    if (moved) (column ?? window).scrollBy(0, moved);
  }

  /** Several people doing the same thing become one row: favorites and boosts of the same post, a run of follows */
  type Row = { key: string; n: Notification; accounts: Account[] };
  const GROUPED = new Set(['favourite', 'reblog', 'follow', 'follow_request']);
  const MAX_AVATARS = 10;

  const rows = $derived.by(() => {
    const out: Row[] = [];
    const byPost = new Map<string, Row>();
    for (const n of items) {
      if (!GROUPED.has(n.type)) {
        out.push({ key: n.id, n, accounts: [n.account] });
        continue;
      }
      if (n.type === 'follow' || n.type === 'follow_request') {
        // Only neighbours of the same kind: a follow between other things stays where it is
        const last = out.at(-1);
        if (last && last.n.type === n.type) {
          if (!last.accounts.some((a) => a.id === n.account.id)) last.accounts.push(n.account);
          continue;
        }
        out.push({ key: `${n.type}|${n.id}`, n, accounts: [n.account] });
        continue;
      }
      const key = n.status ? `${n.type}|${n.status.id}` : n.id;
      const row = byPost.get(key);
      if (row) {
        if (!row.accounts.some((a) => a.id === n.account.id)) row.accounts.push(n.account);
        continue;
      }
      const created: Row = { key, n, accounts: [n.account] };
      byPost.set(key, created);
      out.push(created);
    }
    return out;
  });

  /** The text of a post without its markup, for the short grey excerpt (a content warning stands in for the text) */
  function excerpt(n: Notification): string {
    const st = n.status;
    if (!st) return '';
    const html = st.spoiler_text.trim() ? `<p>${st.spoiler_text}</p>` : st.content;
    const doc = new DOMParser().parseFromString(html.replace(/<\/p>|<br\s*\/?>/gi, ' '), 'text/html');
    return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  const nameHtml = (a: Account) => `<strong>${sanitizeText(a.display_name || a.username, a.emojis)}</strong>`;

  /** "Maija", "Maija and Pekka", "Maija and 6 others", in the message of the notification's type */
  function line(n: Notification, accounts: Account[]): string {
    const [first, second] = accounts;
    const rest = accounts.length - 1;
    const names =
      rest === 0
        ? nameHtml(first)
        : rest === 1
          ? t('notif.and', { a: '\u0001', b: '\u0002' }).replace('\u0001', nameHtml(first)).replace('\u0002', nameHtml(second))
          : t('notif.and', { a: '\u0001', b: '\u0002' }).replace('\u0001', nameHtml(first)).replace('\u0002', t('notif.others', { count: rest }));
    const [before, after = ''] = t(`notif.${n.type}` as 'notif.favourite', { name: '\u0003' }).split('\u0003');
    // The names are built from escaped parts; the rest of the message is escaped here
    return sanitizeText(before) + names + sanitizeText(after);
  }
</script>

<div class="notifs" bind:this={root}>
<div class="refresh">
  <div class="filter" role="group" aria-label={t('notif.filter')}>
    <button class:on={filter === 'all'} aria-pressed={filter === 'all'} onclick={() => setFilter('all')}>{t('notif.all')}</button>
    <button class:on={filter === 'mentions'} aria-pressed={filter === 'mentions'} onclick={() => setFilter('mentions')}>{t('notif.mentions')}</button>
  </div>
  <button class="reload" onclick={reload} disabled={loading}>{loading && !items.length ? t('common.loading') : t('feed.loadNew')}</button>
</div>

<div class="list">
  {#each rows as row (row.key)}
    {@const n = row.n}
    {#if n.type === 'follow' || n.type === 'follow_request'}
      <div class="group follow">
        <span class="icon">
          {#if n.type === 'follow'}<UserPlus size={26} aria-hidden="true" />{:else}<UserCheck size={26} aria-hidden="true" />{/if}
        </span>
        <div class="gbody">
          {@render avatars(row.accounts)}
          <p class="gtext"><span class="grow">{@html line(n, row.accounts)}</span><span class="time">{formatRelativeTime(n.created_at, i18n.locale)}</span></p>
        </div>
      </div>
    {:else if n.status}
      <div class="item" class:lined={WITH_LINE.has(n.type)}>
        {#if GROUPED.has(n.type)}
          <div class="group {n.type}">
            <span class="icon">
              {#if n.type === 'reblog'}<Repeat2 size={26} aria-hidden="true" />{:else}<Heart size={26} aria-hidden="true" />{/if}
            </span>
            <div class="gbody">
              {@render avatars(row.accounts)}
              <p class="gtext"><span class="grow">{@html line(n, row.accounts)}</span><span class="time">{formatRelativeTime(n.created_at, i18n.locale)}</span></p>
              <!-- Your own post, as a short grey excerpt that opens the thread -->
              <a class="excerpt" href="#/thread/{n.status.id}" onclick={(e) => { e.preventDefault(); router.openThread(n.status!.id); }}>{excerpt(n)}</a>
            </div>
          </div>
        {:else if WITH_LINE.has(n.type)}
          <p class="note kind {n.type}">
            {#if n.type === 'poll'}<ChartBar size={16} aria-hidden="true" />{:else}<Pencil size={16} aria-hidden="true" />{/if}
            <span class="grow">{#if n.type === 'poll'}{t('notif.poll')}{:else}{@html line(n, row.accounts)}{/if}</span>
            <span class="time">{formatRelativeTime(n.created_at, i18n.locale)}</span>
          </p>
        {/if}
        {#if !LIGHT.has(n.type)}
          <StatusCard status={n.status} />
        {/if}
      </div>
    {/if}
  {/each}
</div>

{#snippet avatars(accounts: Account[])}
  <div class="avatars">
    {#each accounts.slice(0, MAX_AVATARS) as a (a.id)}
      <a href={profileHref(a.acct)} onclick={(e) => { e.preventDefault(); router.openProfile(a); }} title="@{a.acct}">
        <img src={a.avatar} alt="" width="44" height="44" loading="lazy" decoding="async" />
      </a>
    {/each}
  </div>
{/snippet}

{#if error}
  <p class="msg error" role="alert">
    {error}
    <button onclick={() => (items.length ? loadMore() : refresh())}>{t('common.retry')}</button>
  </p>
{/if}

{#if end && !items.length && !error}
  <p class="msg">{t('notif.empty')}</p>
{:else if items.length && !end}
  <div class="older">
    <button onclick={loadMore} disabled={loading}>{loading ? t('common.loading') : t('feed.loadOlder')}</button>
  </div>
{/if}
</div>

<style>
  .refresh { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; padding: 0.5rem 1rem; background: var(--bg); border-bottom: 1px solid var(--border); }
  .filter { display: flex; gap: 0.3rem; }
  .filter button { min-height: 2.25rem; padding: 0 0.9rem; border: 1px solid transparent; border-radius: 999px; background: none; color: var(--muted); font-weight: 600; }
  .filter button.on { background: var(--surface); border-color: var(--border); color: var(--text); }
  .reload { border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: 0.5rem; padding: 0.4rem 0.9rem; }
  .list { overflow-anchor: none; }
  .note { display: flex; gap: 0.6rem; align-items: center; padding: 0.8rem 1rem 0; margin: 0; color: var(--muted); font-size: 0.9rem; }
  .kind { display: inline-flex; gap: 0.4rem; align-items: center; font-weight: 600; color: var(--text); }
  .note .grow { flex: 1; min-width: 0; }
  .note.kind { display: flex; }
  .note.kind :global(svg) { flex: none; }
  /* Several people at once: their avatars in a row and one line of text; the icon on the left says what they did */
  .group { display: flex; gap: 0.75rem; padding: 0.9rem 1rem 0; }
  .group.follow { padding-bottom: 0.9rem; border-bottom: 1px solid var(--border); }
  /* As wide as a post's avatar with the icon centred in it (as tall as the avatar), so the text starts at the same place as in the posts around it */
  .icon { flex: none; width: 44px; display: flex; justify-content: center; padding-top: 9px; color: var(--accent); }
  .gbody { flex: 1; min-width: 0; }
  .avatars { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .avatars a { display: block; }
  .avatars img { display: block; border-radius: var(--radius-avatar); border: var(--avatar-border); background: var(--surface); }
  .gtext { display: flex; gap: 0.6rem; align-items: baseline; margin: 0.5rem 0 0.2rem; color: var(--text); }
  /* A custom emoji in a name is a picture the size of the text (it is full size without this) */
  .gtext :global(img.emoji), .note :global(img.emoji) { height: 1.2em; width: 1.2em; object-fit: contain; vertical-align: middle; }
  .gtext .grow { flex: 1; min-width: 0; overflow-wrap: anywhere; }
  /* At most two lines, in grey */
  .excerpt { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; color: var(--muted); text-decoration: none; overflow-wrap: anywhere; }
  .excerpt:hover { text-decoration: underline; }
  .group.favourite, .group.reblog { padding-bottom: 0.9rem; border-bottom: 1px solid var(--border); }
  .reblog .icon { color: var(--boost); }
  .favourite .icon { color: var(--like); }
  .poll :global(svg), .update :global(svg) { color: var(--accent); }
  .time { color: var(--muted); font-size: 0.82rem; font-weight: 400; flex: none; }
  /* The line sits above the post it is about, so the post starts closer to it */
  .lined :global(article) { padding-top: 0.3rem; }
  .msg { text-align: center; color: var(--muted); padding: 1rem; margin: 0; }
  .msg.error { color: var(--danger); }
  .msg button { border: 1px solid var(--border); background: var(--bg); color: var(--text); border-radius: 0.4rem; padding: 0.3rem 0.8rem; }
  .older { text-align: center; padding: 0.8rem; }
  .older button { border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: 0.5rem; padding: 0.5rem 1.2rem; }
</style>
