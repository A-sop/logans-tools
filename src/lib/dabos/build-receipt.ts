/**
 * Zero-token build hand-off receipts (Div4 OUT basket) + open-order classification + stall routing.
 * Acceptance: docs/acceptance/2026-11-01_build_receipts_open_orders_stall.ACCEPTANCE.md
 *
 * Dedupe: ingest_source='build-receipt' + ingest_external_id='<order_id>:<phase>'
 * Stall: ingest_source='dept2-stall' + ingest_external_id='<order_id>:<Berlin YYYY-MM-DD>' (P4 style)
 */
import type { DabosSql } from '@/lib/dabos/dabos-connection';

function berlinStamp(d: Date): string {
  const s = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
  return `${s} Berlin`;
}

export const BUILD_RECEIPT_SOURCE = 'build-receipt';
export const STALL_SOURCE = 'dept2-stall';
export const OPEN_AFTER_FINISH_MS = 24 * 60 * 60 * 1000;

export type BuildReceiptPhase = 'start' | 'finish';
export type FinishStatus = 'done' | 'failed';
export type OpenOrderStatus = 'running' | 'done' | 'stalled';

export type StartReceiptInput = {
  orderId: string;
  repo: string;
  branch: string;
  machine: string;
  expectedFinish: string;
  prLinks?: string[];
  startedAt?: string;
};

export type FinishReceiptInput = {
  orderId: string;
  status: FinishStatus;
  prLinks?: string[];
  finishedAt?: string;
};

export type BuildReceiptRow = {
  orderId: string;
  phase: BuildReceiptPhase;
  repo: string | null;
  branch: string | null;
  machine: string | null;
  expectedFinish: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  finishStatus: FinishStatus | null;
  prLinks: string[];
  createdAt: string;
};

export type OpenOrderLine = {
  orderId: string;
  status: OpenOrderStatus;
  repo: string;
  branch: string;
  machine: string;
  lastActivityAt: string;
  lastActivityBerlin: string;
  expectedFinish: string | null;
};

export type WriteReceiptResult = {
  wrote: boolean;
  externalId: string;
  id: string | null;
};

function requireOrderId(orderId: string): string {
  const id = orderId.trim();
  if (!id || id.length > 200) throw new Error('order_id required (1–200 chars)');
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/.test(id)) {
    throw new Error('order_id has illegal characters');
  }
  return id;
}

function requireIso(label: string, raw: string): string {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new Error(`${label} must be ISO datetime`);
  return d.toISOString();
}

/** Berlin calendar day YYYY-MM-DD (same as courier P4). */
export function berlinDay(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function externalIdFor(orderId: string, phase: BuildReceiptPhase): string {
  return `${requireOrderId(orderId)}:${phase}`;
}

export function stallExternalId(orderId: string, day: string): string {
  return `${requireOrderId(orderId)}:${day}`;
}

async function insertOutReceipt(
  sql: DabosSql,
  args: {
    orderId: string;
    phase: BuildReceiptPhase;
    title: string;
    description: string;
    meta: Record<string, unknown>;
  }
): Promise<WriteReceiptResult> {
  const externalId = externalIdFor(args.orderId, args.phase);
  const inserted = await sql`
    INSERT INTO tasks (
      workspace_id, division_id, department_id, title, description,
      type, status, priority, basket, ingest_source, ingest_external_id, ingest_meta
    ) VALUES (
      ${'build-receipt'},
      ${'Div4'},
      ${'Dept12'},
      ${args.title},
      ${args.description},
      ${'agent'},
      ${args.phase === 'finish' ? 'done' : 'todo'},
      ${3},
      ${'out'},
      ${BUILD_RECEIPT_SOURCE},
      ${externalId},
      ${JSON.stringify(args.meta)}::jsonb
    )
    ON CONFLICT DO NOTHING
    RETURNING id::text AS id
  `;
  if (inserted.length === 1) {
    return { wrote: true, externalId, id: String(inserted[0].id) };
  }
  return { wrote: false, externalId, id: null };
}

export async function writeStartReceipt(
  sql: DabosSql,
  input: StartReceiptInput
): Promise<WriteReceiptResult> {
  const orderId = requireOrderId(input.orderId);
  const expectedFinish = requireIso('expected_finish', input.expectedFinish);
  const startedAt = input.startedAt
    ? requireIso('started_at', input.startedAt)
    : new Date().toISOString();
  const prLinks = input.prLinks ?? [];
  const meta = {
    kind: 'build-receipt',
    phase: 'start',
    order_id: orderId,
    from: 'Div4',
    repo: input.repo,
    branch: input.branch,
    machine: input.machine,
    started_at: startedAt,
    expected_finish: expectedFinish,
    pr_links: prLinks,
  };
  return insertOutReceipt(sql, {
    orderId,
    phase: 'start',
    title: `Build start ${orderId}`,
    description: `${input.repo} ${input.branch} on ${input.machine}; expected ${expectedFinish}`,
    meta,
  });
}

export async function writeFinishReceipt(
  sql: DabosSql,
  input: FinishReceiptInput
): Promise<WriteReceiptResult> {
  const orderId = requireOrderId(input.orderId);
  if (input.status !== 'done' && input.status !== 'failed') {
    throw new Error('finish status must be done|failed');
  }
  const finishedAt = input.finishedAt
    ? requireIso('finished_at', input.finishedAt)
    : new Date().toISOString();
  const prLinks = input.prLinks ?? [];
  const meta = {
    kind: 'build-receipt',
    phase: 'finish',
    order_id: orderId,
    from: 'Div4',
    status: input.status,
    finished_at: finishedAt,
    pr_links: prLinks,
  };
  return insertOutReceipt(sql, {
    orderId,
    phase: 'finish',
    title: `Build finish ${orderId} (${input.status})`,
    description: `status=${input.status} at ${finishedAt}`,
    meta,
  });
}

type Meta = Record<string, unknown>;

function asMeta(raw: unknown): Meta {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Meta;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw) as unknown;
      if (p && typeof p === 'object' && !Array.isArray(p)) return p as Meta;
    } catch {
      /* ignore */
    }
  }
  return {};
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length ? v : null;
}

function strList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}

/** Load build-receipt rows (start + finish) from tasks. */
export async function readBuildReceipts(sql: DabosSql): Promise<BuildReceiptRow[]> {
  const rows = await sql`
    SELECT id::text AS id,
           ingest_external_id AS external_id,
           ingest_meta AS meta,
           created_at AS created_at
      FROM tasks
     WHERE ingest_source = ${BUILD_RECEIPT_SOURCE}
       AND (ingest_meta->>'kind' = 'build-receipt' OR ingest_meta->>'kind' IS NULL)
     ORDER BY created_at ASC
  `;
  const out: BuildReceiptRow[] = [];
  for (const r of rows as Array<Record<string, unknown>>) {
    const meta = asMeta(r.meta);
    const phase = meta.phase === 'finish' ? 'finish' : meta.phase === 'start' ? 'start' : null;
    const orderId =
      str(meta.order_id) ??
      (typeof r.external_id === 'string' ? r.external_id.replace(/:(start|finish)$/, '') : null);
    if (!phase || !orderId) continue;
    out.push({
      orderId,
      phase,
      repo: str(meta.repo),
      branch: str(meta.branch),
      machine: str(meta.machine),
      expectedFinish: str(meta.expected_finish),
      startedAt: str(meta.started_at),
      finishedAt: str(meta.finished_at),
      finishStatus:
        meta.status === 'done' || meta.status === 'failed' ? (meta.status as FinishStatus) : null,
      prLinks: strList(meta.pr_links),
      createdAt: toIso(r.created_at),
    });
  }
  return out;
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return new Date(v).toISOString();
  return new Date().toISOString();
}

/**
 * Open from start until 24 h after finish.
 * stalled = start, no finish, now > expected_finish.
 */
export function classifyOpenOrders(receipts: BuildReceiptRow[], now: Date): OpenOrderLine[] {
  const byOrder = new Map<string, { start?: BuildReceiptRow; finish?: BuildReceiptRow }>();
  for (const r of receipts) {
    const slot = byOrder.get(r.orderId) ?? {};
    if (r.phase === 'start') slot.start = r;
    else slot.finish = r;
    byOrder.set(r.orderId, slot);
  }
  const lines: OpenOrderLine[] = [];
  for (const [orderId, slot] of byOrder) {
    const start = slot.start;
    if (!start) continue;
    const finish = slot.finish;
    let status: OpenOrderStatus = 'running';
    let lastActivityAt = start.startedAt ?? start.createdAt;
    if (finish) {
      const finishedAt = finish.finishedAt ?? finish.createdAt;
      lastActivityAt = finishedAt;
      const closeAt = new Date(finishedAt).getTime() + OPEN_AFTER_FINISH_MS;
      if (now.getTime() > closeAt) continue; // no longer open
      status = 'done';
    } else {
      const expected = start.expectedFinish ? new Date(start.expectedFinish) : null;
      if (expected && !Number.isNaN(expected.getTime()) && now.getTime() > expected.getTime()) {
        status = 'stalled';
      }
    }
    lines.push({
      orderId,
      status,
      repo: start.repo ?? '—',
      branch: start.branch ?? '—',
      machine: start.machine ?? '—',
      lastActivityAt,
      lastActivityBerlin: berlinStamp(new Date(lastActivityAt)),
      expectedFinish: start.expectedFinish,
    });
  }
  lines.sort((a, b) => a.orderId.localeCompare(b.orderId));
  return lines;
}

export async function readOpenOrders(sql: DabosSql, now: Date): Promise<OpenOrderLine[]> {
  const receipts = await readBuildReceipts(sql);
  return classifyOpenOrders(receipts, now);
}

/** Render "## Open orders" digest section. */
export function buildOpenOrdersSection(orders: OpenOrderLine[] | null): string {
  if (orders === null) return '';
  const L: string[] = [];
  L.push(`## Open orders (${orders.length})`);
  if (orders.length === 0) {
    L.push('- none');
  } else {
    for (const o of orders) {
      L.push(
        `- ${o.status}: ${o.orderId} · ${o.repo} · ${o.branch} · ${o.machine} · last ${o.lastActivityBerlin}`
      );
    }
  }
  L.push('');
  return L.join('\n');
}

export type StallRouteResult = {
  orderId: string;
  wrote: boolean;
  externalId: string;
};

/**
 * Route stalled orders to Dept2 IN. Never sets pending.
 * At most once per order per Berlin day (P4 dedupe).
 */
export async function routeStalledBuildOrders(
  sql: DabosSql,
  stalled: OpenOrderLine[],
  now: Date
): Promise<StallRouteResult[]> {
  const day = berlinDay(now);
  const results: StallRouteResult[] = [];
  for (const o of stalled) {
    if (o.status !== 'stalled') continue;
    const externalId = stallExternalId(o.orderId, day);
    const meta = {
      stall_of: o.orderId,
      rule: 'build_order_past_expected_finish',
      from: 'build-receipt',
      repo: o.repo,
      branch: o.branch,
      machine: o.machine,
      expected_finish: o.expectedFinish,
    };
    const inserted = await sql`
      INSERT INTO tasks (
        workspace_id, division_id, department_id, title, description,
        type, status, priority, basket, ingest_source, ingest_external_id, ingest_meta
      ) VALUES (
        ${'comm-center'},
        ${'Div1'},
        ${'Dept2'},
        ${`Stall: build order ${o.orderId}`.slice(0, 200)},
        ${`Build order ${o.orderId} past expected_finish; repo ${o.repo} branch ${o.branch}`},
        ${'agent'},
        ${'todo'},
        ${2},
        ${'in'},
        ${STALL_SOURCE},
        ${externalId},
        ${JSON.stringify(meta)}::jsonb
      )
      ON CONFLICT DO NOTHING
      RETURNING id::text AS id
    `;
    results.push({
      orderId: o.orderId,
      wrote: inserted.length === 1,
      externalId,
    });
  }
  return results;
}
