import type { Context, Status } from './api/types';

export interface ThreadRow {
  status: Status;
  depth: number;
  focused: boolean;
  /** The next row is a deeper reply to this one: a line continues from this post's avatar to it. */
  hasChild: boolean;
  /**
   * For each column of an ancestor's line (index 0 is the column of the depth 1 post's avatar): that ancestor has
   * another reply below this row, so its line runs through it. The line is not drawn below its last reply.
   */
  through: boolean[];
  /** The line of the parent's column turns here to this row's avatar (every reply from depth 2 on) */
  elbow: boolean;
  /** The handle of the author this reply answers, when it answers a reply and the post right above it is not that one (or the depth is capped): the indentation alone does not tell. */
  replyTo?: string;
}

export const MAX_DEPTH = 3;

/**
 * The replies so that every reply comes right under the post it answers (depth first), whatever order the server
 * listed them in: the lines and indentation only make sense when a reply is inside its parent's branch. Siblings
 * keep the server's order. A reply whose parent is not in the thread is shown as a reply to the selected post.
 */
function inTreeOrder(replies: Status[], focusedId: string): Status[] {
  const known = new Set([focusedId, ...replies.map((r) => r.id)]);
  const children = new Map<string, Status[]>();
  for (const r of replies) {
    const parent = r.in_reply_to_id && known.has(r.in_reply_to_id) && r.in_reply_to_id !== r.id ? r.in_reply_to_id : focusedId;
    children.set(parent, [...(children.get(parent) ?? []), r]);
  }
  const ordered: Status[] = [];
  const seen = new Set<string>();
  const visit = (id: string) => {
    for (const child of children.get(id) ?? []) {
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      ordered.push(child);
      visit(child.id);
    }
  };
  visit(focusedId);
  return ordered;
}

/**
 * The thread as a flat list: ancestors first (no indentation), then the selected post, then the
 * replies indented by reply depth (at most MAX_DEPTH).
 */
export function threadRows(ctx: Context, focused: Status): ThreadRow[] {
  const depthById = new Map<string, number>();
  const rows: ThreadRow[] = [];

  for (const status of ctx.ancestors) {
    depthById.set(status.id, 0);
    rows.push({ status, depth: 0, focused: false, hasChild: false, through: [], elbow: false });
  }
  depthById.set(focused.id, 0);
  rows.push({ status: focused, depth: 0, focused: true, hasChild: false, through: [], elbow: false });

  const authorById = new Map<string, string>();
  const descendants = inTreeOrder(ctx.descendants, focused.id);
  for (const status of [...ctx.ancestors, focused, ...descendants]) authorById.set(status.id, status.account.acct);

  for (const status of descendants) {
    const parentDepth = (status.in_reply_to_id && depthById.get(status.in_reply_to_id)) || 0;
    const depth = Math.min(parentDepth + 1, MAX_DEPTH);
    depthById.set(status.id, depth);
    rows.push({ status, depth, focused: false, hasChild: false, through: [], elbow: false });
  }
  for (let i = 0; i < rows.length - 1; i++) {
    const next = rows[i + 1];
    rows[i].hasChild = !rows[i].focused && next.depth > rows[i].depth && next.status.in_reply_to_id === rows[i].status.id;
  }
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    row.elbow = row.depth >= 2;
    // The column of the post at depth `level` goes on while another reply to it (depth level + 1) follows in its branch
    row.through = Array.from({ length: Math.max(row.depth - 1, 0) }, (_, k) => {
      const level = k + 1;
      for (let j = i + 1; j < rows.length && rows[j].depth > level; j++) if (rows[j].depth === level + 1) return true;
      return false;
    });
  }
  const focusIdx = rows.findIndex((r) => r.focused);
  for (let i = focusIdx + 1; i < rows.length; i++) {
    const parentId = rows[i].status.in_reply_to_id;
    const directlyAbove = !!parentId && rows[i - 1].status.id === parentId;
    // At the depth cap the reply sits beside the post it answers, so the position does not tell either
    const capped = !!parentId && depthById.get(parentId) === rows[i].depth;
    // An answer to the selected post needs no label: the page is about that post
    if (parentId && parentId !== rows[focusIdx].status.id && (!directlyAbove || capped)) rows[i].replyTo = authorById.get(parentId);
  }
  return rows;
}
