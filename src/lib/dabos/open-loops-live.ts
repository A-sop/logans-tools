import 'server-only';

import { getDabosSql, hasDabosDb } from '@/lib/dabos/db';
import {
  DEPT_ORDER,
  getOpenLoopsSnapshot,
  type OpenLoopDept,
  type OpenLoopItem,
  type OpenLoopsSnapshot,
} from '@/lib/dabos/open-loops';

/**
 * Task statuses that count as open on the board (same set as countOpenTasks).
 * Include legacy `open` — some despatches used it; without this they vanish from /open.
 */
const OPEN_STATUSES = ['todo', 'doing', 'blocked', 'open'];

type TaskRow = {
  id: string;
  title: string | null;
  description: string | null;
  status: string;
  priority: number | null;
  priority_reason: string | null;
  department_id: string | null;
  basket: string | null;
  ingest_meta: Record<string, unknown> | null;
  created_at: string | Date;
};

function fieldFromDescription(description: string | null, key: string): string {
  if (!description) return '';
  const re = new RegExp(`^${key}:\\s*(.+)$`, 'im');
  const m = description.match(re);
  return m?.[1]?.trim() ?? '';
}

function parseLoopFields(row: TaskRow): { why: string; canonical: string; resume: string } {
  const meta = row.ingest_meta ?? {};
  const human = fieldFromDescription(row.description, 'Human');
  const ssot =
    fieldFromDescription(row.description, 'SSOT') ||
    (typeof meta.canonical === 'string' ? meta.canonical : '') ||
    '';
  const resume =
    fieldFromDescription(row.description, 'Resume') ||
    (typeof meta.resume === 'string' ? meta.resume : '') ||
    '';
  const prompt = fieldFromDescription(row.description, 'Prompt');
  const whyBase = human || row.title || '(untitled)';
  const why = prompt ? `${whyBase}\nPrompt: ${prompt}` : whyBase;
  return { why, canonical: ssot, resume };
}

/**
 * Heat from live task fields:
 * - hot: doing/blocked, or priority 1-3 (promotion, income, financial cans)
 * - ship: status "review" (ready to ship)
 * - open: everything else
 */
function heatFor(row: TaskRow): OpenLoopItem['heat'] {
  if (row.status === 'review') return 'ship';
  if (row.status === 'doing' || row.status === 'blocked') return 'hot';
  if (row.priority != null && row.priority <= 3) return 'hot';
  return 'open';
}

function asDept(id: string | null): OpenLoopDept {
  return (DEPT_ORDER as string[]).includes(id ?? '') ? (id as OpenLoopDept) : 'Dept21';
}

/**
 * Live open-loops data from Neon `tasks` (open statuses, grouped by department).
 * Goals (aim targets) still come from the static config in the snapshot file.
 * Falls back to the bundled snapshot when no DB is configured.
 */
export async function getLiveOpenLoops(): Promise<OpenLoopsSnapshot & { live: boolean }> {
  const fallback = getOpenLoopsSnapshot();
  if (!hasDabosDb()) return { ...fallback, live: false };

  const sql = getDabosSql();
  const statuses = [...OPEN_STATUSES, 'review'];
  const rows = (await sql`
    SELECT id::text, title, description, status, priority, priority_reason, department_id, basket,
           ingest_meta, created_at
    FROM tasks
    WHERE status = ANY(${statuses})
      AND basket IN ('in', 'pending')
    ORDER BY priority ASC NULLS LAST, created_at ASC
  `) as TaskRow[];

  const closedRows = (await sql`
    SELECT department_id,
           COUNT(*)::int AS closed_all,
           COUNT(*) FILTER (WHERE COALESCE(completed_at, updated_at) >= NOW() - INTERVAL '7 days')::int AS closed_7d
    FROM tasks
    WHERE status = 'done'
    GROUP BY department_id
  `) as { department_id: string | null; closed_all: number; closed_7d: number }[];

  const since = new Date(Date.now() - 7 * 864e5);
  const items: OpenLoopItem[] = rows.map((r) => {
    const parsed = parseLoopFields(r);
    return {
      id: r.id,
      why: parsed.why,
      canonical: parsed.canonical,
      resume: parsed.resume,
      heat: heatFor(r),
      segment: fallback.segments[0],
      dept: asDept(r.department_id),
      source: 'chat-backlog',
      status: r.status,
      priority: r.priority,
      priority_reason: r.priority_reason,
      created_at: new Date(r.created_at).toISOString(),
    };
  });

  const hot = items.filter((i) => i.heat === 'hot');
  const open = items.filter((i) => i.heat === 'open');
  const ship = items.filter((i) => i.heat === 'ship');

  const byDept: Record<string, number> = {};
  const lastWeek: Record<string, { closed: number; still_open: number }> = {};
  for (const d of DEPT_ORDER) lastWeek[d] = { closed: 0, still_open: 0 };
  for (const i of items) {
    byDept[i.dept] = (byDept[i.dept] ?? 0) + 1;
    if (i.heat !== 'ship' && i.created_at && new Date(i.created_at) >= since) lastWeek[i.dept].still_open++;
  }
  let closed = 0;
  let closed7 = 0;
  for (const c of closedRows) {
    closed += c.closed_all;
    closed7 += c.closed_7d;
    lastWeek[asDept(c.department_id)].closed += c.closed_7d;
  }
  const stillOpen = hot.length + open.length;

  return {
    ...fallback,
    live: true,
    generated_at: new Date().toISOString(),
    sources: { backlog: 'neon:tasks', shipBoard: 'neon:tasks(status=review)' },
    counts: {
      hot: hot.length,
      open: open.length,
      ship: ship.length,
      still_open: stillOpen,
      closed,
      total: items.length,
      by_segment: {},
      by_dept: byDept,
    },
    last_week: {
      window_days: 7,
      since: since.toISOString().slice(0, 10),
      closed: closed7,
      still_open: Object.values(lastWeek).reduce((a, b) => a + b.still_open, 0),
      by_dept: lastWeek,
    },
    hot,
    open,
    ship,
  };
}
