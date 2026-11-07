/**
 * Additive 20:45 digest section for three-basket stations (SCOPE v3).
 * Plugs into #61 status-digest as an extra markdown block — not a second digest.
 */
import type { CommPost } from '@/lib/dabos/comm-center/posts';
import { COMM_POSTS } from '@/lib/dabos/comm-center/posts';

export type CommStationRow = {
  post: CommPost;
  in_count: number;
  pending_count: number;
  out_count: number;
  pending_cleared_count: number;
  pending_past_clear_by: number;
  oldest_in_age: string | null;
  oldest_pending_since: string | null;
  never_reviewed_count: number;
};

export type PendingApprovalBrief = {
  id: string;
  title: string;
  kind: string;
};

export type Dept13Line = {
  repo: string;
  number: number;
  line: string;
};

export type WakeWithoutReceipt = {
  post: CommPost;
  woke_at: string;
};

export type CommCenterDigestInput = {
  stations: CommStationRow[] | null;
  approvals: PendingApprovalBrief[] | null;
  dept13Lines: Dept13Line[] | null;
  wakesWithoutReceipt: WakeWithoutReceipt[] | null;
  sourceErrors?: Array<{ source: string; error: string }>;
};

/** Render the additive section. Empty string when every source is null and no errors. */
export function buildCommCenterDigestSection(input: CommCenterDigestInput): string {
  const L: string[] = [];
  const errors = input.sourceErrors ?? [];
  const hasAny =
    input.stations !== null ||
    input.approvals !== null ||
    input.dept13Lines !== null ||
    input.wakesWithoutReceipt !== null ||
    errors.length > 0;
  if (!hasAny) return '';

  L.push('## Comm center (IN / PENDING / OUT)');
  L.push('');

  if (input.stations) {
    L.push('| Post | IN | PENDING | OUT | cleared | past clear_by | oldest IN | oldest PENDING | never reviewed |');
    L.push('|---|---:|---:|---:|---:|---:|---|---|---:|');
    const byPost = new Map(input.stations.map((r) => [r.post, r]));
    for (const post of COMM_POSTS) {
      const r = byPost.get(post) ?? {
        post,
        in_count: 0,
        pending_count: 0,
        out_count: 0,
        pending_cleared_count: 0,
        pending_past_clear_by: 0,
        oldest_in_age: null,
        oldest_pending_since: null,
        never_reviewed_count: 0,
      };
      L.push(
        `| ${r.post} | ${r.in_count} | ${r.pending_count} | ${r.out_count} | ${r.pending_cleared_count} | ${r.pending_past_clear_by} | ${r.oldest_in_age ?? '—'} | ${r.oldest_pending_since ?? '—'} | ${r.never_reviewed_count} |`
      );
    }
    L.push('');
  }

  if (input.approvals) {
    L.push(`### Pending approval_queue (${input.approvals.length})`);
    if (input.approvals.length === 0) {
      L.push('- none');
    } else {
      for (const a of input.approvals) {
        L.push(`- ${a.kind}: ${a.title} (${a.id.slice(0, 8)})`);
      }
    }
    L.push('');
  }

  if (input.dept13Lines) {
    L.push('### Dept13 PASS/FAIL lines');
    if (input.dept13Lines.length === 0) {
      L.push('- none on open PRs');
    } else {
      for (const d of input.dept13Lines) {
        L.push(`- ${d.repo}#${d.number}: ${d.line}`);
      }
    }
    L.push('');
  }

  if (input.wakesWithoutReceipt && input.wakesWithoutReceipt.length > 0) {
    L.push('### Woke without hat receipt');
    for (const w of input.wakesWithoutReceipt) {
      L.push(`- ${w.post} woke at ${w.woke_at}`);
    }
    L.push('');
  }

  if (errors.length > 0) {
    L.push('### Comm-center source errors');
    for (const e of errors) {
      L.push(`- ${e.source}: ${e.error}`);
    }
    L.push('');
  }

  return L.join('\n');
}

/** Shape a `v_comm_station` query row into CommStationRow. */
export function mapStationRow(row: Record<string, unknown>): CommStationRow {
  const post = String(row.post ?? '');
  if (!(COMM_POSTS as readonly string[]).includes(post)) {
    throw new Error(`v_comm_station returned unknown post: ${post}`);
  }
  return {
    post: post as CommPost,
    in_count: Number(row.in_count ?? 0),
    pending_count: Number(row.pending_count ?? 0),
    out_count: Number(row.out_count ?? 0),
    pending_cleared_count: Number(row.pending_cleared_count ?? 0),
    pending_past_clear_by: Number(row.pending_past_clear_by ?? 0),
    oldest_in_age: row.oldest_in_age == null ? null : String(row.oldest_in_age),
    oldest_pending_since: row.oldest_pending_since == null ? null : String(row.oldest_pending_since),
    never_reviewed_count: Number(row.never_reviewed_count ?? 0),
  };
}
