import type { DabosSql } from '@/lib/dabos/dabos-connection';

export type ApprovalDetail = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  payload: Record<string, unknown>;
  status: string;
  requestedBy: string;
  decidedBy: string | null;
  divisionId: string | null;
  departmentId: string | null;
  taskId: string | null;
  dedupeKey: string | null;
  createdAt: string;
  decidedAt: string | null;
};

function toIso(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

export async function readApprovalById(
  sql: DabosSql,
  id: string
): Promise<ApprovalDetail | null> {
  const rows = (await sql`
    SELECT
      id::text AS id,
      kind,
      title,
      body,
      payload,
      status,
      requested_by,
      decided_by,
      division_id,
      department_id,
      task_id::text AS task_id,
      created_at,
      decided_at
    FROM approval_queue
    WHERE id = ${id}::uuid
    LIMIT 1
  `) as Array<{
    id: string;
    kind: string;
    title: string;
    body: string | null;
    payload: unknown;
    status: string;
    requested_by: string;
    decided_by: string | null;
    division_id: string | null;
    department_id: string | null;
    task_id: string | null;
    created_at: Date | string;
    decided_at: Date | string | null;
  }>;

  const r = rows[0];
  if (!r) return null;

  const payload =
    r.payload && typeof r.payload === 'object' && !Array.isArray(r.payload)
      ? (r.payload as Record<string, unknown>)
      : {};

  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    payload,
    status: r.status,
    requestedBy: r.requested_by,
    decidedBy: r.decided_by,
    divisionId: r.division_id,
    departmentId: r.department_id,
    taskId: r.task_id,
    dedupeKey: null,
    createdAt: toIso(r.created_at) ?? new Date().toISOString(),
    decidedAt: toIso(r.decided_at),
  };
}

export async function listPendingApprovalsDetailed(
  sql: DabosSql,
  limit = 50
): Promise<ApprovalDetail[]> {
  const rows = (await sql`
    SELECT
      id::text AS id,
      kind,
      title,
      body,
      payload,
      status,
      requested_by,
      decided_by,
      division_id,
      department_id,
      task_id::text AS task_id,
      created_at,
      decided_at
    FROM approval_queue
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT ${limit}
  `) as Array<{
    id: string;
    kind: string;
    title: string;
    body: string | null;
    payload: unknown;
    status: string;
    requested_by: string;
    decided_by: string | null;
    division_id: string | null;
    department_id: string | null;
    task_id: string | null;
    created_at: Date | string;
    decided_at: Date | string | null;
  }>;

  return rows.map((r) => {
    const payload =
      r.payload && typeof r.payload === 'object' && !Array.isArray(r.payload)
        ? (r.payload as Record<string, unknown>)
        : {};
    return {
      id: r.id,
      kind: r.kind,
      title: r.title,
      body: r.body,
      payload,
      status: r.status,
      requestedBy: r.requested_by,
      decidedBy: r.decided_by,
      divisionId: r.division_id,
      departmentId: r.department_id,
      taskId: r.task_id,
      dedupeKey: null,
      createdAt: toIso(r.created_at) ?? new Date().toISOString(),
      decidedAt: toIso(r.decided_at),
    };
  });
}

/** Context path hint from payload (repo/path/host) — never secrets. */
export function approvalContextPath(payload: Record<string, unknown>): string | null {
  const parts: string[] = [];
  const repo = payload.repo;
  const pr = payload.pr;
  if (typeof repo === 'string' && repo) {
    parts.push(typeof pr === 'number' || typeof pr === 'string' ? `${repo}#${pr}` : repo);
  }
  const host = payload.host;
  if (typeof host === 'string' && host) parts.push(`host:${host}`);
  const path = payload.path ?? payload.context_path ?? payload.file;
  if (typeof path === 'string' && path) parts.push(path);
  const decision = payload.decision;
  if (typeof decision === 'string' && decision) parts.push(`decision:${decision}`);
  return parts.length ? parts.join(' · ') : null;
}
