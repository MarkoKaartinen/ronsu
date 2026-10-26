<script lang="ts">
  import Check from '@lucide/svelte/icons/check';
  import { getContext } from 'svelte';
  import type { MastodonClient } from '../lib/api/client';
  import { getPoll, votePoll } from '../lib/api/polls';
  import type { Poll } from '../lib/api/types';
  import { sanitizeText } from '../lib/html';
  import { formatAge } from '../lib/i18n';
  import { canVote, pick } from '../lib/pollLogic';
  import { i18n, t } from '../lib/stores/i18n.svelte';
  import { toast } from '../lib/stores/toast.svelte';

  /** own: the poll belongs to the signed-in account, which cannot vote in it. onchange gets the poll the server answers a vote or a refresh with */
  let { poll, own = false, onchange }: { poll: Poll; own?: boolean; onchange: (poll: Poll) => void } = $props();

  const client = getContext<MastodonClient>('mastodon-client');

  let choices = $state<number[]>([]);
  let busy = $state(false);
  let refreshing = $state(false);
  /** The results of an open poll are looked at without voting (Mastodon's "See results"; Ronsu also leads back to voting, the choices made are kept) */
  let revealed = $state(false);

  // A multiple-choice poll's percentages are of the people who voted, a single-choice poll's of the votes
  const total = $derived(poll.multiple ? (poll.voters_count ?? 0) : poll.votes_count);
  const open = $derived(canVote(poll, own));
  const showResults = $derived(!open || revealed);
  // A poll whose author hides the totals until it ends has no counts to show
  const hasTotals = $derived(poll.options.some((o) => o.votes_count !== null));

  /** The end of a poll: "Closed", "Ends in 3h" or, within the last minute, "Ends soon" */
  function end(): string {
    if (poll.expired) return t('poll.closed');
    if (!poll.expires_at) return '';
    const age = formatAge(Date.parse(poll.expires_at) - Date.now(), i18n.locale);
    return age === null ? t('poll.endingSoon') : t('poll.endsIn', { age });
  }

  /** The results of an open poll show the votes of others as they were when the post was loaded; this fetches them again */
  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    try {
      onchange(await getPoll(client, poll.id));
    } catch (err) {
      toast.show(t('action.failed', { message: err instanceof Error ? err.message : String(err) }));
    } finally {
      refreshing = false;
    }
  }

  async function vote(e: SubmitEvent) {
    e.preventDefault();
    if (busy || !choices.length) return;
    busy = true;
    try {
      onchange(await votePoll(client, poll.id, choices));
    } catch (err) {
      toast.show(t('action.failed', { message: err instanceof Error ? err.message : String(err) }));
    } finally {
      busy = false;
    }
  }
</script>

{#if showResults}
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
{:else}
  <form class="poll" id="poll-{poll.id}" onsubmit={vote}>
    {#each poll.options as o, i}
      <label class="choice" class:picked={choices.includes(i)}>
        <input
          type={poll.multiple ? 'checkbox' : 'radio'}
          name="poll-{poll.id}"
          checked={choices.includes(i)}
          onchange={() => (choices = pick(choices, i, poll.multiple))}
        />
        <span class="ptitle">{@html sanitizeText(o.title, poll.emojis)}</span>
      </label>
    {/each}
  </form>
{/if}
<div class="pmeta">
  {#if !showResults}
    <button class="vote" type="submit" form="poll-{poll.id}" disabled={busy || !choices.length}>{t('poll.vote')}</button>
    {#if hasTotals}<button class="link" type="button" onclick={() => (revealed = true)}>{t('poll.reveal')}</button><span aria-hidden="true">·</span>{/if}
  {:else}
    {#if open}<button class="link" type="button" onclick={() => (revealed = false)}>{t('poll.back')}</button><span aria-hidden="true">·</span>{/if}
    {#if !poll.expired}<button class="link" type="button" disabled={refreshing} onclick={refresh}>{t('poll.refresh')}</button><span aria-hidden="true">·</span>{/if}
  {/if}
  <span>{[t('poll.votes', { count: poll.voters_count ?? poll.votes_count }), end()].filter(Boolean).join(' · ')}</span>
</div>

<style>
  .poll { list-style: none; margin: 0.6rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
  .poll li, .choice { position: relative; display: flex; gap: 0.6rem; align-items: center; justify-content: space-between; padding: 0.5rem 0.7rem; border: 1px solid color-mix(in srgb, var(--muted) 45%, var(--border)); border-radius: 0.6rem; overflow: hidden; }
  .poll li::before { content: ''; position: absolute; inset: 0 auto 0 0; width: var(--pct); background: color-mix(in srgb, var(--accent) 22%, transparent); }
  .poll li.mine { border-color: color-mix(in srgb, var(--accent) 60%, var(--border)); }
  .choice { justify-content: flex-start; min-height: 2.75rem; cursor: pointer; }
  .choice.picked { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, transparent); }
  /* The browser's own radio buttons and checkboxes are dark on dark in a dark theme, so they are drawn here: a ring in the muted colour, filled with the accent when picked */
  .choice input { appearance: none; flex: none; position: relative; width: 1.25rem; height: 1.25rem; margin: 0; border: 2px solid var(--muted); border-radius: 50%; background: transparent; }
  .choice input[type='checkbox'] { border-radius: 0.3rem; }
  .choice input:checked { border-color: var(--accent); background: var(--accent); }
  .choice input[type='radio']:checked { background: radial-gradient(circle, var(--on-accent) 0 30%, var(--accent) 35%); }
  .choice input[type='checkbox']:checked::after { content: ''; position: absolute; left: 0.3rem; top: 0.05rem; width: 0.3rem; height: 0.6rem; border: solid var(--on-accent); border-width: 0 2px 2px 0; transform: rotate(45deg); }
  .choice input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .ptitle, .ppct { position: relative; }
  .ptitle { display: flex; gap: 0.35rem; align-items: center; min-width: 0; overflow-wrap: anywhere; }
  .ptitle :global(svg) { flex: none; color: var(--accent); }
  .ppct { flex: none; font-weight: 600; font-variant-numeric: tabular-nums; }
  .vote { min-height: 2.5rem; padding: 0 1.1rem; border: 1px solid var(--accent); background: var(--accent); color: var(--on-accent); border-radius: 0.4rem; font-weight: 600; }
  .vote:disabled { opacity: 0.5; }
  /* The button, the link and the numbers share one line, and wrap when the column is narrow */
  .pmeta { display: flex; flex-wrap: wrap; gap: 0.2rem 0.5rem; align-items: center; margin: 0.4rem 0 0; color: var(--muted); font-size: 0.85rem; }
  .pmeta .vote { margin-right: 0.3rem; font-size: 1rem; }
  .link { min-height: 2.25rem; padding: 0; border: 0; background: none; color: var(--muted); font: inherit; text-decoration: underline; }
  .link:hover { color: var(--text); }
  .link:disabled { opacity: 0.5; }
</style>
