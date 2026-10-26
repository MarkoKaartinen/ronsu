<script lang="ts">
  import Check from '@lucide/svelte/icons/check';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import { getContext } from 'svelte';
  import type { MastodonClient } from '../lib/api/client';
  import { getPoll, votePoll } from '../lib/api/polls';
  import type { Poll } from '../lib/api/types';
  import { sanitizeText } from '../lib/html';
  import { formatAge } from '../lib/i18n';
  import { canVote, pick } from '../lib/pollLogic';
  import { i18n, t } from '../lib/stores/i18n.svelte';
  import { toast } from '../lib/stores/toast.svelte';

  /** onchange gets the poll the server answers a vote with (the new counts and the account's own votes) */
  let { poll, onchange }: { poll: Poll; onchange: (poll: Poll) => void } = $props();

  const client = getContext<MastodonClient>('mastodon-client');

  let choices = $state<number[]>([]);
  let busy = $state(false);
  let refreshing = $state(false);

  // A multiple-choice poll's percentages are of the people who voted, a single-choice poll's of the votes
  const total = $derived(poll.multiple ? (poll.voters_count ?? 0) : poll.votes_count);
  const open = $derived(canVote(poll));

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

{#if open}
  <form class="poll" onsubmit={vote}>
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
    <button class="vote" type="submit" disabled={busy || !choices.length}>{t('poll.vote')}</button>
  </form>
{:else}
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
{/if}
<p class="pmeta">
  {[t('poll.votes', { count: poll.voters_count ?? poll.votes_count }), end()].filter(Boolean).join(' · ')}
  {#if !open && !poll.expired}
    <button class="refresh" type="button" disabled={refreshing} aria-label={t('poll.refresh')} title={t('poll.refresh')} onclick={refresh}><RefreshCw size={14} /></button>
  {/if}
</p>

<style>
  .poll { list-style: none; margin: 0.6rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
  .poll li, .choice { position: relative; display: flex; gap: 0.6rem; align-items: center; justify-content: space-between; padding: 0.5rem 0.7rem; border: 1px solid var(--border); border-radius: 0.6rem; overflow: hidden; }
  .poll li::before { content: ''; position: absolute; inset: 0 auto 0 0; width: var(--pct); background: color-mix(in srgb, var(--accent) 22%, transparent); }
  .poll li.mine, .choice.picked { border-color: color-mix(in srgb, var(--accent) 60%, var(--border)); }
  .choice { justify-content: flex-start; min-height: 2.75rem; cursor: pointer; }
  .choice input { flex: none; accent-color: var(--accent); }
  .ptitle, .ppct { position: relative; }
  .ptitle { display: flex; gap: 0.35rem; align-items: center; min-width: 0; overflow-wrap: anywhere; }
  .ptitle :global(svg) { flex: none; color: var(--accent); }
  .ppct { flex: none; font-weight: 600; font-variant-numeric: tabular-nums; }
  .vote { align-self: flex-start; min-height: 2.5rem; padding: 0 1.1rem; border: 1px solid var(--accent); background: var(--accent); color: var(--bg); border-radius: 0.4rem; font-weight: 600; }
  .vote:disabled { opacity: 0.5; }
  .pmeta { display: flex; gap: 0.4rem; align-items: center; margin: 0.4rem 0 0; color: var(--muted); font-size: 0.85rem; }
  .refresh { display: inline-flex; align-items: center; justify-content: center; width: 2.25rem; height: 2.25rem; margin: -0.5rem 0; border: 0; background: none; color: var(--muted); border-radius: 0.4rem; }
  .refresh:hover { color: var(--text); }
  .refresh:disabled { opacity: 0.5; }
</style>
