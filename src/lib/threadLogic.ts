import type { Context, Status } from './api/types';

export interface ThreadRow {
  status: Status;
  depth: number;
  focused: boolean;
}

export const MAX_DEPTH = 3;

/**
 * The thread as a flat list: ancestors first (no indentation), then the selected post, then the
 * replies indented by reply depth (at most MAX_DEPTH).
 */
export function threadRows(ctx: Context, focused: Status): ThreadRow[] {
  const depthById = new Map<string, number>();
  const rows: ThreadRow[] = [];

  for (const status of ctx.ancestors) {
    depthById.set(status.id, 0);
    rows.push({ status, depth: 0, focused: false });
  }
  depthById.set(focused.id, 0);
  rows.push({ status: focused, depth: 0, focused: true });

  for (const status of ctx.descendants) {
    const parentDepth = (status.in_reply_to_id && depthById.get(status.in_reply_to_id)) || 0;
    const depth = Math.min(parentDepth + 1, MAX_DEPTH);
    depthById.set(status.id, depth);
    rows.push({ status, depth, focused: false });
  }
  return rows;
}
