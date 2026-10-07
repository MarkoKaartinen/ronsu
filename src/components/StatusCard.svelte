<script lang="ts">
  import type { Status } from '../lib/api/types';
  import { mediaAspect } from '../lib/media';
  import Check from '@lucide/svelte/icons/check';
  import Repeat2 from '@lucide/svelte/icons/repeat-2';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
  import { profileHref, router } from '../lib/router.svelte';
  import ActionBar from './ActionBar.svelte';
  import StatusCard from './StatusCard.svelte';
  import { sanitizeContent, sanitizeText } from '../lib/html';
  import { formatAge, formatDateTime, formatNumber, formatRelativeTime } from '../lib/i18n';
  import { i18n, t, tCounter } from '../lib/stores/i18n.svelte';
  import { lightbox } from '../lib/stores/lightbox.svelte';

  /**
   * focused: the thread's selected post (large layout). rail: a reading rail below the avatar down to the
   * next message (it ends at the selected post's background band). reply: smaller avatar.
   * compact: a light row without action buttons (thread ancestors and replies; a tap opens the post).
   * context: the post a feed reply answers, shown above it with a rail down to it. It is not a reading position
   * (no data-id). joined: the reply under such a post (the rail reaches its avatar). replyTo: the handle of the
   * author it answers, shown as "Replying to". quoted: the post inside a quote post (a framed, light card; it is
   * not a reading position either, and a tap opens the quoted post, not the one that quotes it). actions: such a
   * card keeps its buttons (the original post inside a boost).
   */
  let {
    status,
    focused = false,
    rail = false,
    reply = false,
    compact = false,
    context = false,
    joined = false,
    replyTo,
    quoted = false,
    actions = false,
  }: {
    status: Status;
    focused?: boolean;
    rail?: boolean;
    reply?: boolean;
    compact?: boolean;
    context?: boolean;
    joined?: boolean;
    replyTo?: string;
    quoted?: boolean;
    actions?: boolean;
  } = $props();

  // A boost shows the original; the wrapper's id is still the reading-position key (data-id)
  const s = $derived(status.reblog ?? status);
  const booster = $derived(status.reblog ? status.account : null);
  const boostFrame = $derived(!!status.reblog && !focused && !compact && !context && !quoted && !reply);

  let cwOpen = $state(false);
  let mediaOpen = $state(false);

  const hasCw = $derived(s.spoiler_text.trim() !== '');
  const showBody = $derived(!hasCw || cwOpen);
  const hideMedia = $derived(s.sensitive && !mediaOpen);
  const single = $derived(s.media_attachments.length === 1);
  // The quoted post is shown one level deep; the "RE: link" line that servers put in the text is then redundant
  const quotedStatus = $derived((!quoted || actions) && s.quote?.state === 'accepted' ? s.quote.quoted_status : null);

  /**
   * A long text is cut to about 15 lines with "Read more" (the selected post in a thread is always shown in full).
   * The text is cut by CSS (max-height), so whether it is too long is measured: the content is taller than its
   * box. It is measured again when the size changes (fonts load, the window is resized).
   */
  let contentEl: HTMLElement | undefined = $state();
  let expanded = $state(false);
  let overflowing = $state(false);
  const clampable = $derived(!focused && !expanded);

  // The element only exists while the post is shown (not behind a content warning), hence an effect
  $effect(() => {
    const el = contentEl;
    if (!el) return;
    const measure = () => (overflowing = el.scrollHeight > el.clientHeight + 4);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  });

  /** The end of a poll: "Closed", "Ends in 3h" or, within the last minute, "Ends soon" */
  function pollEnd(poll: NonNullable<Status['poll']>): string {
    if (poll.expired) return t('poll.closed');
    if (!poll.expires_at) return '';
    const age = formatAge(Date.parse(poll.expires_at) - Date.now(), i18n.locale);
    return age === null ? t('poll.endingSoon') : t('poll.endsIn', { age });
  }

  function openBooster(e: Event) {
    e.preventDefault();
    router.openProfile(status.account);
  }

  function openProfile(e: Event) {
    e.preventDefault();
    router.openProfile(s.account);
  }

  /**
   * A plain click on a picture opens the in-app viewer, with all the post's pictures to swipe through. The
   * link stays a real link, so ctrl/cmd/middle-click still opens the picture in a new tab.
   */
  function openImage(e: MouseEvent, id: string) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const images = s.media_attachments.filter((m) => m.type === 'image');
    lightbox.show(images, images.findIndex((m) => m.id === id));
  }

  /**
   * Tapping the card opens the thread, but not on interactive elements (links, buttons, media)
   * or while selecting text. An @mention opens the profile inside the app.
   */
  function onCardClick(e: MouseEvent) {
    if (quoted) e.stopPropagation(); // the card around it would open its own thread otherwise
    const target = e.target as HTMLElement;
    const link = target.closest<HTMLAnchorElement>('a.mention');
    if (link) {
      const mention = s.mentions?.find((m) => m.url === link.href);
      if (mention) {
        e.preventDefault();
        router.openProfile(mention);
      }
      return;
    }
    if (target.closest('a, button, video, audio, input, select, textarea')) return;
    if (getSelection()?.toString()) return;
    if (!focused) router.openThread(s.id);
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<article data-id={context || quoted ? undefined : status.id} class:tappable={!focused} class:focused class:reply class:compact={compact || context || quoted} class:quoted class:framed={quoted && actions} class:railed={rail || context} class:context class:joined onclick={onCardClick}>
  {#if boostFrame && booster}
    <!-- A boost, like a quote: who boosted on top, the original post in a frame below it (with its own buttons) -->
    <div class="layout">
      <div class="side">
        <a class="avatar-link" href={profileHref(booster.acct)} onclick={openBooster} tabindex="-1" aria-hidden="true">
          <img class="avatar" src={booster.avatar} alt="" width="44" height="44" loading="lazy" decoding="async" />
        </a>
      </div>
      <div class="body" title={t('status.boostedBy', { name: booster.display_name || booster.username })}>
        <header>
          <a class="profile" href={profileHref(booster.acct)} onclick={openBooster}>
            <strong>{@html sanitizeText(booster.display_name || booster.username, booster.emojis)}</strong>
            <small>@{booster.acct}</small>
          </a>
          <span class="time">{formatRelativeTime(status.created_at, i18n.locale)}</span>
        </header>
        <p class="boostlabel"><Repeat2 size={14} aria-hidden="true" />{t('status.boost')}</p>
        <StatusCard status={status.reblog!} quoted actions />
      </div>
    </div>
  {:else}
  <div class="layout">
    {#if !focused}
      <div class="side">
        <a class="avatar-link" href={profileHref(s.account.acct)} onclick={openProfile} tabindex="-1" aria-hidden="true">
          <img class="avatar" src={s.account.avatar} alt="" width={reply || quoted ? 36 : 44} height={reply || quoted ? 36 : 44} loading="lazy" />
        </a>
        {#if rail || context}<span class="rail"></span>{/if}
      </div>
    {/if}

    <div class="body">
      {#if focused}
        <a class="fhead" href={profileHref(s.account.acct)} onclick={openProfile}>
          <img class="avatar" src={s.account.avatar} alt="" width="52" height="52" />
          <span class="who">
            <strong>{@html sanitizeText(s.account.display_name || s.account.username, s.account.emojis)}</strong>
            <small>@{s.account.acct}</small>
          </span>
        </a>
      {:else}
        <header>
          <a class="profile" href={profileHref(s.account.acct)} onclick={openProfile}>
            <strong>{@html sanitizeText(s.account.display_name || s.account.username, s.account.emojis)}</strong>
            <small>@{s.account.acct}</small>
          </a>
          <!-- The timestamp links to the original post on its own server; the thread opens by tapping the card -->
          <a class="time" href={s.url ?? s.uri} target="_blank" rel="noopener noreferrer" title="{t('status.openOriginal')} · {formatDateTime(s.created_at, i18n.locale)}">
            {formatRelativeTime(s.created_at, i18n.locale)}
          </a>
        </header>
      {/if}

      {#if replyTo}
        <p class="replyto">{t('status.replyingTo')} <span>@{replyTo}</span></p>
      {/if}

      {#if hasCw}
        <div class="cw">
          <TriangleAlert size={18} aria-hidden="true" />
          <span class="cw-text">{@html sanitizeText(s.spoiler_text, s.emojis)}</span>
          <button onclick={() => (cwOpen = !cwOpen)} aria-expanded={cwOpen}>{cwOpen ? t('status.hidePost') : t('status.showPost')}</button>
        </div>
      {/if}

      {#if showBody}
        <div class="content" class:hasquote={!!quotedStatus} class:clamp={clampable} class:faded={clampable && overflowing} bind:this={contentEl}>{@html sanitizeContent(s.content, s.emojis)}</div>
        {#if clampable && overflowing}
          <button class="more" onclick={() => (expanded = true)}>{t('status.readMore')}</button>
        {/if}

        {#if s.poll}
          {@const poll = s.poll}
          <!-- A multiple-choice poll's percentages are of the people who voted, a single-choice poll's of the votes -->
          {@const total = poll.multiple ? (poll.voters_count ?? 0) : poll.votes_count}
          <ul class="poll">
            {#each poll.options as o, i}
              {@const pct = o.votes_count === null || !total ? null : Math.round((o.votes_count * 100) / total)}
              {@const mine = !!poll.own_votes?.includes(i)}
              <li class:mine style:--pct="{pct ?? 0}%">
                <span class="ptitle">
                  {#if mine}<Check size={16} aria-label={t('poll.yourVote')} />{/if}
                  {@html sanitizeText(o.title, poll.emojis)}
                </span>
                {#if pct !== null}<span class="ppct">{pct}%</span>{/if}
              </li>
            {/each}
          </ul>
          <p class="pmeta">{[t('poll.votes', { count: poll.voters_count ?? poll.votes_count }), pollEnd(poll)].filter(Boolean).join(' · ')}</p>
        {/if}

        {#if s.media_attachments.length}
          <div
            class="media"
            class:single
            class:multi={!single && !hideMedia}
            data-count={s.media_attachments.length}
            style:--aspect={single ? mediaAspect(s.media_attachments[0], true) : undefined}
          >
            {#if hideMedia}
              <button class="reveal" onclick={() => (mediaOpen = true)} title={t('status.showMedia')}>{t('status.sensitive')}</button>
            {:else}
              {#each s.media_attachments as m (m.id)}
                {#if m.type === 'image'}
                  <a href={m.url} target="_blank" rel="noopener noreferrer" onclick={(e) => openImage(e, m.id)} >
                    <img src={m.preview_url} alt={m.description ?? ''} loading="lazy" decoding="async" />
                  </a>
                {:else if m.type === 'video'}
                  <!-- svelte-ignore a11y_media_has_caption -->
                  <video src={m.url} poster={m.preview_url} controls preload="none" playsinline aria-label={m.description ?? ''} ></video>
                {:else if m.type === 'gifv'}
                  <!-- svelte-ignore a11y_media_has_caption -->
                  <video src={m.url} poster={m.preview_url} autoplay loop muted playsinline aria-label={m.description ?? ''} ></video>
                {:else if m.type === 'audio'}
                  <audio src={m.url} controls preload="none"></audio>
                {:else}
                  <a href={m.url} target="_blank" rel="noopener noreferrer">{t('status.attachment')}</a>
                {/if}
              {/each}
            {/if}
          </div>
        {/if}

        {#if quotedStatus}
          <StatusCard status={quotedStatus} quoted />
        {/if}
      {/if}

      {#if focused}
        <p class="meta">
          <a class="time" href={s.url ?? s.uri} target="_blank" rel="noopener noreferrer" title={t('status.openOriginal')}>
            {formatDateTime(s.created_at, i18n.locale)}
          </a>
        </p>
        <p class="stats">
          {#each [['status.replies', s.replies_count], ['status.boosts', s.reblogs_count], ['status.quotes', s.quotes_count], ['status.favorites', s.favourites_count]] as const as [key, count] (key)}
            {#if count !== undefined}
            {@const [before, after] = tCounter(key, count)}
            <span>{before}<strong>{formatNumber(count, i18n.locale)}</strong>{after}</span>
            {/if}
          {/each}
        </p>
      {/if}

      {#if !compact && (!quoted || actions)}
        <ActionBar status={s} large={focused} />
      {/if}
    </div>
  </div>
  {/if}
</article>

<style>
  article { position: relative; padding: 1rem 1rem 0.15rem; border-bottom: 1px solid var(--border); }
  .layout { display: flex; gap: 0.75rem; }
  .side { display: flex; flex-direction: column; align-items: center; flex: none; }
  .avatar { border-radius: var(--radius-avatar); border: var(--avatar-border); display: block; background: var(--surface); }
  .rail { flex: 1; width: 2px; margin: 0.25rem 0 -0.5rem; background: var(--border); }
  .body { flex: 1; min-width: 0; }
  .boostlabel { display: flex; gap: 0.3rem; align-items: center; margin: 0; color: var(--boost); font-size: 0.85rem; font-weight: 600; }
  header { display: flex; gap: 0.4rem; align-items: baseline; }
  .profile { display: flex; gap: 0.4rem; align-items: baseline; min-width: 0; flex: 1; color: inherit; text-decoration: none; }
  .profile strong { font-size: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 0 1 auto; }
  .profile small { color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .profile:hover strong { text-decoration: underline; }
  .time { color: var(--muted); font-size: 0.82rem; text-decoration: none; flex: none; }
  .time:hover { text-decoration: underline; }
  article.tappable { cursor: pointer; }
  /* A content warning stands out in the warning colour (the same as the CW field when writing), and is tinted
     with it instead of a plain surface colour, so it is also visible on the selected post's band */
  .cw { display: flex; gap: 0.6rem; align-items: center; border: 1px solid color-mix(in srgb, var(--marker) 55%, transparent); background: color-mix(in srgb, var(--marker) 13%, transparent); border-radius: 0.6rem; padding: 0.5rem 0.6rem 0.5rem 0.7rem; margin: 0.3rem 0 0.5rem; }
  .cw > :global(svg) { flex: none; color: var(--marker); }
  .cw-text { flex: 1; min-width: 0; font-weight: 600; overflow-wrap: anywhere; }
  .cw button { flex: none; min-height: 2.25rem; border: 1px solid color-mix(in srgb, var(--marker) 55%, transparent); background: var(--bg); color: var(--text); border-radius: 0.4rem; padding: 0 0.7rem; }
  .reveal { border: 1px solid var(--border); background: var(--bg); color: var(--text); border-radius: 0.4rem; padding: 0.3rem 0.7rem; }
  .content { margin-top: 0.15rem; font-size: 1.06rem; line-height: 1.55; overflow-wrap: anywhere; }
  .poll { list-style: none; margin: 0.6rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
  .poll li { position: relative; display: flex; gap: 0.6rem; align-items: center; justify-content: space-between; padding: 0.5rem 0.7rem; border: 1px solid var(--border); border-radius: 0.6rem; overflow: hidden; }
  .poll li::before { content: ''; position: absolute; inset: 0 auto 0 0; width: var(--pct); background: color-mix(in srgb, var(--accent) 22%, transparent); }
  .poll li.mine { border-color: color-mix(in srgb, var(--accent) 60%, var(--border)); }
  .poll .ptitle, .poll .ppct { position: relative; }
  .poll .ptitle { display: flex; gap: 0.35rem; align-items: center; min-width: 0; overflow-wrap: anywhere; }
  .poll .ptitle :global(svg) { flex: none; color: var(--accent); }
  .poll .ppct { flex: none; font-weight: 600; font-variant-numeric: tabular-nums; }
  .pmeta { margin: 0.4rem 0 0; color: var(--muted); font-size: 0.85rem; }
  .content.clamp { max-height: calc(15 * 1.55em); overflow: hidden; }
  .content.faded { mask-image: linear-gradient(#000 calc(100% - 4.5rem), transparent); }
  .more { margin-top: 0.3rem; padding: 0.35rem 0; border: 0; background: none; color: var(--accent); font-weight: 600; }
  .more:hover { text-decoration: underline; }
  .content :global(p) { margin: 0 0 0.6rem; }
  .content :global(p:last-child) { margin-bottom: 0; }
  /* Quotes, code and lists in a post: the browser's defaults (a wide indent without any mark, unstyled code)
     are replaced. The tints are translucent so they work on the page and on the selected post's band alike. */
  .content :global(blockquote) { margin: 0.5rem 0 0.7rem; padding: 0.1rem 0 0.1rem 0.9rem; border-left: 3px solid color-mix(in srgb, var(--accent) 55%, transparent); color: color-mix(in srgb, var(--text) 82%, var(--muted)); }
  .content :global(blockquote p) { margin: 0 0 0.5rem; }
  .content :global(blockquote > :last-child) { margin-bottom: 0; }
  .content :global(pre) { margin: 0.5rem 0 0.7rem; padding: 0.6rem 0.8rem; overflow-x: auto; border-radius: 0.6rem; background: color-mix(in srgb, var(--text) 8%, transparent); font-size: 0.9rem; line-height: 1.45; }
  .content :global(code) { padding: 0.05em 0.35em; border-radius: 0.3rem; background: color-mix(in srgb, var(--text) 8%, transparent); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.9em; }
  .content :global(pre code) { padding: 0; background: none; font-size: inherit; }
  .content :global(ul), .content :global(ol) { margin: 0.3rem 0 0.7rem; padding-left: 1.4rem; }
  .content :global(li) { margin: 0.1rem 0; }
  .content :global(.invisible) { display: none; }
  .content :global(.ellipsis)::after { content: '…'; }
  .content :global(img.emoji), header :global(img.emoji), .fhead :global(img.emoji) { height: 1.2em; width: 1.2em; object-fit: contain; vertical-align: middle; }
  .media { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; margin-top: 0.6rem; border-radius: 0.9rem; overflow: hidden; }
  .media a { display: block; overflow: hidden; background: var(--surface); }
  .media a img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .media video { width: 100%; object-fit: cover; display: block; background: var(--surface); }
  .media audio { grid-column: 1 / -1; width: 100%; }
  /* One picture: the block is exactly as wide as the picture (at most 28rem tall), and the height comes from
     the aspect ratio (--aspect, from the post's metadata), not from the image loading. Sizing the block itself,
     instead of capping the picture inside it, keeps the rounded corners on the picture's own corners. */
  .media.single { display: block; width: min(100%, calc(28rem * var(--aspect, 1.78))); }
  .media.single a, .media.single video { width: 100%; aspect-ratio: var(--aspect, 1.78); }
  .media.single video { object-fit: contain; }

  /* A gallery of several pictures, laid out like Mastodon's so that no cell is left empty and the whole block
     is one rounded rectangle: 2 side by side, 3 = one tall and two stacked, 4 = a 2x2 grid */
  .media.multi { aspect-ratio: 4 / 3; grid-template-rows: 1fr; }
  .media.multi[data-count='3'], .media.multi[data-count='4'] { grid-template-rows: 1fr 1fr; }
  .media.multi[data-count='3'] > :first-child { grid-row: 1 / span 2; }
  .media.multi a, .media.multi video { width: 100%; height: 100%; max-height: none; min-height: 0; }
  /* More than four (some servers allow it): rows of two, an odd last picture takes the full width */
  .media.multi:not([data-count='2'], [data-count='3'], [data-count='4']) { aspect-ratio: auto; grid-template-rows: none; grid-auto-rows: 9rem; }
  .media.multi:not([data-count='2'], [data-count='3'], [data-count='4']) > :last-child:nth-child(odd) { grid-column: 1 / -1; }
  .reveal { grid-column: 1 / -1; padding: 2rem 1rem; background: var(--surface); }

  /* Light thread rows: no action buttons, smaller text */
  .compact { padding-bottom: 1rem; }
  .compact .content { font-size: 1rem; line-height: 1.5; }
  .compact .profile strong { font-size: 0.95rem; }
  .compact:not(.reply) .content { color: color-mix(in srgb, var(--text) 80%, var(--muted)); }
  /* Ancestor: the rail continues to the next message's avatar, no divider line */
  .railed { border-bottom: 0; padding-top: 0.25rem; padding-bottom: 1.1rem; }
  .railed .rail { margin-bottom: -1.1rem; }
  /* Rail centre = avatar centre: 1rem padding + 22 px (half of the 44 px avatar) - 1 px (half the line width) */
  .railed::before, .joined::before { content: ''; position: absolute; left: calc(1rem + 21px); top: 0; height: 0.25rem; width: 2px; background: var(--border); }
  /* In the feed the parent comes first (no rail piece above its avatar) and the reply is joined to it */
  .context { padding-top: 1rem; }
  .context::before { display: none; }
  .joined { padding-top: 0.25rem; }
  .replyto { margin: 0.1rem 0 0; color: var(--muted); font-size: 0.9rem; }
  .replyto span { color: var(--accent); }
  /* A quote: the quoted post in a frame, and the server's "RE: link" line is hidden because the post is there */
  .content.hasquote :global(.quote-inline) { display: none; }
  .quoted { margin-top: 0.6rem; padding: 0.75rem 0.8rem 0.2rem; border: 1px solid var(--border); border-radius: 0.9rem; background: var(--surface); }
  .framed { margin-bottom: 0.85rem; }
  /* A quote inside a framed post (a boosted quote post): the inner frame uses the page background, so it is darker than the outer one in dark themes and stands out in light ones too */
  /* On the selected post's band (also --surface) the frame would vanish: it is darker there too */
  .focused :global(.quoted) { background: var(--bg); }
  .quoted :global(.quoted) { background: var(--bg); border-color: color-mix(in srgb, var(--text) 22%, var(--border)); }
  .quoted .content { font-size: 0.95rem; }
  /* Reply: the divider starts after the avatar, the timestamp follows the handle */
  .reply { padding: 0.9rem 1rem 0; border-bottom: 0; }
  .reply .body { padding-bottom: 0.9rem; border-bottom: 1px solid var(--border); }
  .compact .profile { flex: 0 1 auto; }
  .compact header { justify-content: flex-start; }
  .compact .time::before { content: '· '; }

  /* The thread's selected post: large layout, background band */
  .focused { background: var(--surface); padding-top: 1.1rem; border-top: 1px solid var(--border); }
  .fhead { display: flex; gap: 0.75rem; align-items: center; color: inherit; text-decoration: none; margin-bottom: 0.7rem; }
  .fhead .who { display: grid; min-width: 0; }
  .fhead strong { font-size: 1.1rem; }
  .fhead small { color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .focused .content { font-size: 1.25rem; line-height: 1.55; }
  .meta { margin: 0.9rem 0 0; font-size: 0.9rem; }
  .stats { display: flex; gap: 1.2rem; margin: 0.7rem 0 0; padding: 0.7rem 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); color: var(--muted); font-size: 0.9rem; }
  .stats strong { color: var(--text); }
</style>
