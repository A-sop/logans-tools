import { getDabosSql } from '@/lib/dabos/db';

export type PromptRegisterRow = {
  task_id: string;
  title: string;
  department_id: string | null;
  basket: string | null;
  status: string | null;
  updated_at: string | null;
  register_id: string;
  machine: string;
  source: string;
  needs_logan: string;
  in_person: string;
  estimate: string;
  last_run: string;
  output_path: string;
  prs: string;
  blocker: string;
  register_status: string;
  dept: string;
  history: unknown[];
  paste_line: string;
  stale: boolean;
};

type Filters = {
  machine?: string;
  status?: string;
  dept?: string;
  needsLogan?: string;
  inPerson?: string;
  q?: string;
};

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return (Date.now() - t) / 86400000;
}

export async function fetchPromptRegisterTasks(filters: Filters = {}): Promise<PromptRegisterRow[]> {
  const sql = getDabosSql();
  const rows = await sql`
    SELECT
      id::text AS task_id,
      title,
      department_id,
      basket,
      status,
      updated_at::text AS updated_at,
      ingest_meta->'prompt_register' AS pr
    FROM tasks
    WHERE ingest_meta ? 'prompt_register'
       OR ingest_external_id LIKE 'prompt:%'
    ORDER BY updated_at DESC NULLS LAST
  `;

  const out: PromptRegisterRow[] = [];
  for (const row of rows) {
    const pr = (row.pr ?? {}) as Record<string, unknown>;
    const registerId = String(pr.id ?? (row.task_id as string));
    const machine = String(pr.machine ?? '');
    const registerStatus = String(pr.status ?? row.status ?? '');
    const needs = String(pr.needs_logan ?? 'n');
    const person = String(pr.in_person ?? 'n');
    const dept = String(pr.dept ?? row.department_id ?? '');
    const title = String(row.title ?? '');
    const updated = (row.updated_at as string | null) ?? null;
    const age = daysSince(updated);
    const stale = (registerStatus === 'not_started' || row.basket === 'in') && age !== null && age > 7;

    if (filters.machine && filters.machine !== 'all' && machine.toUpperCase() !== filters.machine.toUpperCase()) {
      continue;
    }
    if (filters.status && filters.status !== 'all' && registerStatus !== filters.status) {
      continue;
    }
    if (filters.dept && filters.dept !== 'all' && !dept.toLowerCase().includes(filters.dept.toLowerCase())) {
      continue;
    }
    if (filters.needsLogan === 'y' && needs !== 'y') continue;
    if (filters.inPerson === 'y' && person !== 'y') continue;
    if (filters.q) {
      const hay = `${registerId} ${title} ${machine} ${dept}`.toLowerCase();
      if (!hay.includes(filters.q.toLowerCase())) continue;
    }

    out.push({
      task_id: String(row.task_id),
      title,
      department_id: (row.department_id as string | null) ?? null,
      basket: (row.basket as string | null) ?? null,
      status: (row.status as string | null) ?? null,
      updated_at: updated,
      register_id: registerId,
      machine,
      source: String(pr.source ?? ''),
      needs_logan: needs,
      in_person: person,
      estimate: String(pr.estimate ?? ''),
      last_run: String(pr.last_run ?? ''),
      output_path: String(pr.output_path ?? ''),
      prs: String(pr.prs ?? ''),
      blocker: String(pr.blocker ?? ''),
      register_status: registerStatus,
      dept,
      history: Array.isArray(pr.history) ? (pr.history as unknown[]) : [],
      paste_line: `Run prompt register item ${registerId} (see ln02 ~/dabos-data/prompt-register/items/${registerId}.md)`,
      stale,
    });
  }
  return out;
}
