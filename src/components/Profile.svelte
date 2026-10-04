<script lang="ts">
  import BadgeCheck from '@lucide/svelte/icons/badge-check';
  import ExternalLink from '@lucide/svelte/icons/external-link';
  import { onMount, setContext, untrack } from 'svelte';
  import { getAccount, getRelationship, lookupAccount } from '../lib/api/accounts';
  import { ApiError, type MastodonClient } from '../lib/api/client';
  import { startLogin } from '../lib/api/oauth';
  import type { AccountFull, Relationship, Status } from '../lib/api/types';
  import { isFollowing, toggleFollow } from '../lib/follow';
  import { sanitizeContent, sanitizeText } from '../lib/html';
  import { formatDate, formatNumber } from '../lib/i18n';
  import { accountStore } from '../lib/stores/accounts.svelte';
  import { i18n, t } from '../lib/stores/i18n.svelte';
  import { toast } from '../lib/stores/toast.svelte';
  import StatusCard from './StatusCard.svelte';

  // handle: "@user@server" (or a numeric account id from an older link)
  let { client, handle }: { client: MastodonClient; handle: string } = $props();

  // The action buttons (ActionBar) of the post list get the client from the context
  // svelte-ignore state_referenced_locally
  setContext('mastodon-client', client);

  const PAGE = 20;
  const number = { format: (n: number) => formatNumber(n, i18n.locale) };

  let account = $state<AccountFull | null>(null);
  let rel = $state<Relationship | null>(null);
  let statuses = $state<Status[]>([]);
  let error = $state('');
  let loadingMore = $state(false);
  let end = $state(false);
  let busy = $state(false);
  /** Following needs the write:follows scope, which an old login does not have */
  let needsReauth = $state(false);
  let sentinel: HTMLElement | undefined = $state();

  const isSelf = $derived(account?.id === accountStore.active?.accountId);
  const following = $derived(rel ? isFollowing(rel) : false);
  /** The profile page on the account's own server, e.g. https://mstdn.social/@magdalenahai */
  const origin = $derived.by(() => {
    try {
      const url = new URL(account?.url ?? '');
      return url.protocol === 'https:' || url.protocol === 'http:' ? { href: url.href, domain: url.hostname } : null;
    } catch {
      return null;
    }
  });

  async function loadAccount() {
    try {
      account = handle.startsWith('@') ? await lookupAccount(client, handle.slice(1)) : await getAccount(client, handle);
      if (account.id !== accountStore.active?.accountId) rel = await getRelationship(client, account.id);
    } catch (e) {
      error = e instanceof ApiError && e.status === 404 ? t('profile.notFound') : errorText(e);
    }
  }

  async function loadMore() {
    if (!account || loadingMore || end || error) return;
    loadingMore = true;
    try {
      const last = statuses[statuses.length - 1];
      const page = await client.getPage<Status>(`/api/v1/accounts/${account.id}/statuses`, {
        limit: PAGE,
        exclude_replies: 'true',
        max_id: last?.id,
      });
      // Never list the same post twice (a duplicate key would crash the keyed list)
      const known = new Set(statuses.map((s) => s.id));
      const fresh = page.items.filter((s) => !known.has(s.id));
      if (fresh.length === 0) end = true;
      else statuses.push(...fresh);
    } catch (e) {
      error = errorText(e);
    } finally {
      loadingMore = false;
    }
  }

  async function onFollow() {
    if (!account || !rel || busy) return;
    busy = true;
    try {
      await toggleFollow(client, account, rel);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) needsReauth = true;
      else toast.show(t('profile.followFailed', { message: errorText(e) }));
    } finally {
      busy = false;
    }
  }

  const reauth = () => accountStore.active && startLogin(accountStore.active.instance);
  const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

  onMount(() => {
    window.scrollTo(0, 0);
    loadAccount();
  });

  // Infinite scrolling: when the sentinel at the bottom becomes visible, fetch the next page
  $effect(() => {
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) untrack(loadMore);
      },
      { rootMargin: '600px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  });
</script>

{#if error}
  <p class="msg error" role="alert">{error}</p>
{:else if !account}
  <p class="msg">{t('common.loading')}</p>
{:else}
  <section class="profile">
    <div class="banner">
      {#if account.header && !account.header.endsWith('missing.png')}
        <img class="cover" src={account.header} alt="" />
      {:else}
        <div class="cover"></div>
      {/if}
      <!-- The action sits on the banner (not half over its edge), on a translucent backdrop so it stays readable on any picture -->
      <div class="action">
        {#if isSelf}
          <span class="self">{t('profile.yourProfile')}</span>
        {:else if rel}
          <button class="follow" class:secondary={following} disabled={busy} onclick={onFollow}>
            {rel.following || rel.requested ? (rel.requested ? t('profile.cancelRequest') : t('profile.unfollow')) : account.locked ? t('profile.followRequest') : t('profile.follow')}
          </button>
        {/if}
      </div>
    </div>

    <div class="top">
      <img class="avatar" src={account.avatar} alt="" width="80" height="80" />
    </div>

    {#if needsReauth}
      <div class="notice" role="alert">
        <span>{t('profile.reauth')}</span>
        <button onclick={reauth}>{t('profile.reauthButton')}</button>
      </div>
    {/if}

    <h2>{@html sanitizeText(account.display_name || account.username, account.emojis)}</h2>
    <p class="acct">
      {#if origin}
        <!-- The handle links to the profile page on the account's own server; the title tells where it goes -->
        <a class="handle" href={origin.href} target="_blank" rel="noopener noreferrer" title={t('profile.viewOn', { domain: origin.domain })}>
          @{account.acct}<ExternalLink size={13} aria-hidden="true" />
        </a>
      {:else}
        @{account.acct}
      {/if}
      {#if rel?.followed_by}<span class="badge">{t('profile.followsYou')}</span>{/if}
      {#if account.locked}<span class="badge">{t('profile.locked')}</span>{/if}
      {#if account.bot}<span class="badge">{t('profile.bot')}</span>{/if}
    </p>

    {#if account.note}
      <div class="note">{@html sanitizeContent(account.note, account.emojis)}</div>
    {/if}

    <!-- The profile's own fields (links, pronouns, ...) as the account owner wrote them -->
    {#if account.fields?.length}
      <dl class="fields">
        <!-- Keyed by position: an account may have several fields with the same name -->
        {#each account.fields as field, i (i)}
          <div class="field">
            <dt>{@html sanitizeText(field.name, account.emojis)}</dt>
            <dd>
              <span class="value">{@html sanitizeContent(field.value, account.emojis)}</span>
              {#if field.verified_at}
                {@const proof = t('profile.linkVerified', { date: formatDate(field.verified_at, i18n.locale) })}
                <span class="check" title={proof}><BadgeCheck size={16} aria-label={proof} /></span>
              {/if}
            </dd>
          </div>
        {/each}
      </dl>
    {/if}

    <dl class="counts">
      <div><dt>{t('profile.posts')}</dt><dd>{number.format(account.statuses_count)}</dd></div>
      <div><dt>{t('profile.following')}</dt><dd>{number.format(account.following_count)}</dd></div>
      <div><dt>{t('profile.followers')}</dt><dd>{number.format(account.followers_count)}</dd></div>
    </dl>
  </section>

  {#if statuses.length}
    <h3 class="section">{t('profile.posts')}</h3>
  {/if}
  <div class="list">
    {#each statuses as status (status.id)}
      <StatusCard {status} />
    {/each}
  </div>

  {#if loadingMore}
    <p class="msg">Ladataan…</p>
  {:else if end}
    <p class="msg">{statuses.length ? t('profile.noMore') : t('profile.noPosts')}</p>
  {/if}
  <div bind:this={sentinel} class="sentinel" aria-hidden="true"></div>
{/if}

<style>
  .msg { text-align: center; color: var(--muted); padding: 1.5rem 1rem; margin: 0; }
  .msg.error { color: var(--danger); }
  .profile { padding-bottom: 1rem; border-bottom: 1px solid var(--border); }
  .cover { display: block; width: 100%; aspect-ratio: 3 / 1; object-fit: cover; background: var(--surface); }
  .banner { position: relative; }
  .action { position: absolute; top: 0.75rem; right: 1rem; }
  .top { padding: 0 1rem; margin-top: -2.75rem; position: relative; }
  /* The thick ring in the page colour separates the avatar from the banner; the faint edge is drawn inside it */
  .avatar { width: 5.5rem; height: 5.5rem; object-fit: cover; border-radius: var(--radius-avatar); border: 4px solid var(--bg); outline: var(--avatar-border); outline-offset: -4px; background: var(--surface); }
  .self { display: inline-block; color: var(--text); font-size: 0.9rem; font-weight: 600; padding: 0.5rem 0.9rem; border-radius: 999px; background: color-mix(in srgb, var(--bg) 75%, transparent); backdrop-filter: blur(6px); }
  .follow { min-height: 2.75rem; padding: 0 1.4rem; border: 0; border-radius: 999px; background: var(--accent); color: var(--on-accent); font-weight: 700; font-size: 1rem; }
  .follow.secondary { background: color-mix(in srgb, var(--bg) 75%, transparent); backdrop-filter: blur(6px); color: var(--text); }
  .follow:disabled { opacity: 0.6; cursor: default; }
  .notice { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; margin: 0.8rem 1rem 0; padding: 0.7rem 0.9rem; border-radius: 0.9rem; background: var(--surface); border: 1px solid var(--border); }
  .notice span { flex: 1; min-width: 12rem; }
  .notice button { min-height: 2.75rem; border: 1px solid var(--border); background: var(--bg); color: var(--text); border-radius: 0.6rem; padding: 0 0.9rem; font-weight: 600; }
  h2 { margin: 0.7rem 1rem 0; font-size: 1.5rem; letter-spacing: -0.01em; overflow-wrap: anywhere; }
  h2 :global(img.emoji), .note :global(img.emoji) { height: 1.2em; width: 1.2em; object-fit: contain; vertical-align: middle; }
  .acct { margin: 0.15rem 1rem 0; color: var(--muted); overflow-wrap: anywhere; }
  .handle { display: inline-flex; align-items: center; gap: 0.3rem; color: inherit; text-decoration: none; }
  .handle:hover { text-decoration: underline; color: var(--accent); }
  .badge { margin-left: 0.4rem; padding: 0.1rem 0.55rem; border-radius: 999px; background: var(--surface); border: 1px solid var(--border); font-size: 0.75rem; font-weight: 600; }
  .note { margin: 0.8rem 1rem 0; font-size: 1.02rem; line-height: 1.55; overflow-wrap: anywhere; }
  .note :global(p) { margin: 0 0 0.5rem; }
  /* Fields: a small label above its value, no lines. A column is at least 14rem wide, so two fit side by side
     in the reading column (at most 38rem inside the margins, never room for three) and a phone gets one. */
  .fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: 0.8rem 1.5rem; margin: 1rem 1rem 0; }
  .fields dt { color: var(--muted); font-size: 0.78rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; overflow-wrap: anywhere; }
  .fields dd { display: flex; gap: 0.4rem; align-items: baseline; margin: 0.1rem 0 0; min-width: 0; overflow-wrap: anywhere; }
  .fields .value { min-width: 0; }
  .fields .check { display: inline-flex; flex: none; align-self: center; color: var(--boost); }
  .fields .value :global(p) { margin: 0; }
  .fields .value :global(.invisible) { display: none; }
  .fields .value :global(.ellipsis)::after { content: '…'; }
  .counts { display: flex; margin: 1rem 1rem 0; padding: 0.8rem 0; border-top: 1px solid var(--border); }
  .counts div { flex: 1; display: grid; justify-items: center; }
  .counts div + div { border-left: 1px solid var(--border); }
  .counts dt { color: var(--muted); font-size: 0.8rem; order: 2; }
  .counts dd { margin: 0; font-weight: 700; font-size: 1.15rem; }
  .section { margin: 0; padding: 1rem 1rem 0.6rem; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); border-bottom: 1px solid var(--border); }
  .sentinel { height: 1px; }
</style>
