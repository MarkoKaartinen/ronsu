import type { FilterContext, FilterResult, Status } from './api/types';

/** What the user's server-side filters say about a post: hide it, cover it with a warning, or blur its media */
export interface FilterVerdict {
  action: 'hide' | 'warn' | 'blur';
  /** The titles of the filters that matched with that action (never the keywords) */
  titles: string[];
}

/**
 * The strongest of the active filters that matched a post in the given view: hide, then warn, then blur. A filter
 * is active when it applies in that view and has not expired. An action this app does not know counts as warn,
 * as the Mastodon docs say. A boost carries the filters of the post it boosts, so both are read.
 * https://docs.joinmastodon.org/entities/Filter/ and https://docs.joinmastodon.org/api/guidelines/
 */
export function filterVerdict(status: Status, context: FilterContext, now = Date.now()): FilterVerdict | null {
  const matches: FilterResult[] = [...(status.filtered ?? []), ...(status.reblog?.filtered ?? [])];
  const actions: Record<FilterVerdict['action'], string[]> = { hide: [], warn: [], blur: [] };
  for (const { filter } of matches) {
    if (!filter.context.includes(context)) continue;
    if (filter.expires_at && Date.parse(filter.expires_at) <= now) continue;
    const action = filter.filter_action === 'hide' || filter.filter_action === 'blur' ? filter.filter_action : 'warn';
    if (!actions[action].includes(filter.title)) actions[action].push(filter.title);
  }
  for (const action of ['hide', 'warn', 'blur'] as const) {
    if (actions[action].length) return { action, titles: actions[action] };
  }
  return null;
}
