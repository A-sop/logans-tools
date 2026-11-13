import type { Sql } from '@/lib/dabos/db';

import { fetchOrgMap } from '@/lib/dabos/server-data';
import { getStatCutoffSnapshot } from '@/lib/dabos/org-week';

export type ApprovalRow = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  status: string;
  created_at: string;
};

export type ApprovalDetail = ApprovalRow & {
  payload: Record<string, unknown>;
  requested_by: string;
  division_id: string | null;
  department_id: string | null;
  decided_by: string | null;
  decided_at: string | null;
};

export async function fetchApprovalDetail(
  sql: Sql,
  id: string
): Promise<ApprovalDetail | null> {
  const rows = await sql`
    SELECT
      id,
      kind,
      title,
      body,
      payload,
      status,
      requested_by,
      division_id,
      department_id,
      decided_by,
      decided_at,
      created_at
    FROM approval_queue
    WHERE id = ${id}::uuid
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  const payload =
    row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
      ? (row.payload as Record<string, unknown>)
      : {};
  return {
    id: row.id as string,
    kind: row.kind as string,
    title: row.title as string,
    body: (row.body as string | null) ?? null,
    status: row.status as string,
    created_at: (row.created_at as Date).toISOString(),
    payload,
    requested_by: (row.requested_by as string) ?? 'system',
    division_id: (row.division_id as string | null) ?? null,
    department_id: (row.department_id as string | null) ?? null,
    decided_by: (row.decided_by as string | null) ?? null,
    decided_at: row.decided_at ? (row.decided_at as Date).toISOString() : null,
  };
}

export async function fetchPendingApprovals(sql: Sql, limit = 10): Promise<ApprovalRow[]> {
  const rows = await sql`
    SELECT id, kind, title, body, status, created_at
    FROM approval_queue
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    id: r.id as string,
    kind: r.kind as string,
    title: r.title as string,
    body: (r.body as string | null) ?? null,
    status: r.status as string,
    created_at: (r.created_at as Date).toISOString(),
  }));
}

export async function formatTier0Stats(sql: Sql): Promise<string> {
  const cutoff = getStatCutoffSnapshot();
  const divisions = await fetchOrgMap();

  const lines = [
    `DABOS stats · week through ${cutoff.week_label}`,
  ];

  for (const div of divisions) {
    const cond = div.latest_condition?.condition ?? '—';
    const statVal = div.primary_stat?.value ?? '—';
    lines.push(
      `${div.id} ${div.operational_name}: ${div.primary_metric_key}=${statVal} · ${cond} · open=${div.open_task_count}`
    );
  }

  return lines.join('\n');
}

export async function formatTier0Board(sql: Sql): Promise<string> {
  const divisions = await fetchOrgMap();
  const lines = ['DABOS board snapshot'];

  for (const div of divisions) {
    const cond = div.latest_condition?.condition ?? 'Normal';
    lines.push(`• ${div.id} — ${cond} (${div.open_task_count} open)`);
  }

  return lines.join('\n');
}

export async function formatTier0Approvals(sql: Sql): Promise<string> {
  const pending = await fetchPendingApprovals(sql, 8);
  if (pending.length === 0) {
    return 'Approvals: none pending.';
  }

  const lines = ['Pending approvals:'];
  for (const a of pending) {
    lines.push(`• ${a.id.slice(0, 8)} [${a.kind}] ${a.title}`);
  }
  lines.push('Approve: /approve <id>  (Slack, Telegram, or API)');
  return lines.join('\n');
}

/** Max chars for founder_reply (matches DB check + human_context discipline). */
export const FOUNDER_REPLY_MAX = 800;

export function normalizeFounderReply(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return null;
  return trimmed.length > FOUNDER_REPLY_MAX
    ? trimmed.slice(0, FOUNDER_REPLY_MAX)
    : trimmed;
}

export async function decideApproval(
  sql: Sql,
  id: string,
  action: 'approve' | 'reject',
  decidedBy: string,
  founderReply?: string | null
): Promise<{ ok: true; row: ApprovalRow } | { ok: false; error: string }> {
  const status = action === 'approve' ? 'approved' : 'rejected';
  const reply = normalizeFounderReply(founderReply);
  const rows = await sql`
    UPDATE approval_queue
    SET
      status = ${status},
      decided_by = ${decidedBy},
      decided_at = NOW(),
      founder_reply = ${reply}
    WHERE id = ${id}::uuid AND status = 'pending'
    RETURNING id, kind, title, body, status, created_at
  `;
  const row = rows[0];
  if (!row) {
    return { ok: false, error: 'Approval not found or already decided' };
  }
  return {
    ok: true,
    row: {
      id: row.id as string,
      kind: row.kind as string,
      title: row.title as string,
      body: (row.body as string | null) ?? null,
      status: row.status as string,
      created_at: (row.created_at as Date).toISOString(),
    },
  };
}
