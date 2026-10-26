import { SvelteSet } from 'svelte/reactivity';

/** Ids of the posts deleted in this session: every card of such a post (also a boost of it) disappears from every view */
export const deletedIds = new SvelteSet<string>();
