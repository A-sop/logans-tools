/**
 * RR-010 step 1: the watchman, a script gatekeeper for agent-to-agent messages (ln02).
 *
 * Logan, 1 Nov 2026 15:18 Berlin: "What about a watchman who makes sure it's absolutely necessary
 * to wake and if not, adds to the batch. This usage is crazy".
 * Spec: docs/acceptance/2026-11-01_watchman.ACCEPTANCE.md (AC1-AC9) + AMENDMENT-1.md.
 *
 * Not an LLM. Every decision here is a pure function of the row, the clock and the config, so it is
 * unit-tested. The runner (scripts/dabos/watchman.ts) runs one tick every 5 minutes.
 *
 * Safety:
 * - bodies are never read (the reader selects length(body) only), so they cannot reach a log.
 * - logs carry ids, counts and decisions only; never subjects, bodies, webhook URLs or keys.
 * - every failure names its owner post (Dept12 Production, Div4) and is filed to div4's inbox.
 */
import type { DabosSql } from '@/lib/dabos/dabos-connection';

export const TIMEZONE = 'Europe/Berlin';
export const BATCH_INTERVAL_MS = 2 * 60 * 60 * 1000;
export const BATCH_WINDOW_START_HOUR = 7;
export const BATCH_WINDOW_END_HOUR = 23;
export const DEADLINE_SOON_MS = 6 * 60 * 60 * 1000;
export const ACK_BODY_MAX = 280;
export const METRICS_ROLE_ID = 'watchman_daily';
export const WATCHMAN_SENDER = 'watchman';
export const FAILURE_OWNER = 'Dept12 Production, Div4';
export const FAILURE_RECIPIENT = 'div4';

export const LOGAN = 'logan';
export const LDW = 'ldw';
/** Agents the watchman can wake (each has one webhook routine). */
export const AGENT_IDS = ['ldw', 'div1', 'div2', 'div3', 'div4', 'div5', 'div6', 'div7'] as const;
export type AgentId = (typeof AGENT_IDS)[number];
/** Hat names that resolve to the agent wearing them. Dept13/Dept14 sit with the Div5 agent. */
export const AGENT_ALIASES: Record<string, AgentId> = { dept13: 'div5', dept14: 'div5' };
export const KNOWN_PARTIES: ReadonlySet<string> = new Set<string>([LOGAN, ...AGENT_IDS]);

export const URGENCY_CLAIMS = ['none', 'urgent', 'blocking', 'deadline_today'] as const;
export type UrgencyClaim = (typeof URGENCY_CLAIMS)[number];
/** AC3 (d) allowlist, as reason codes (Amendment 1, A3). */
export const URGENT_REASON_CODES = ['prod_down', 'data_loss', 'security', 'deadline_6h'] as const;
/** AC3 (a): honoured only when from_agent = 'ldw'. */
export const LOGAN_RELAY_CODES = ['logan_order', 'logan_decision'] as const;

export const ACK_SUBJECT =
  /^(re:\s*)?(ack|acked|acknowledged|received|noted|thanks|thank you|thx|ok|okay|on it|standing by|got it|will do|roger)\s*[.!]*$/i;
export const FYI_SUBJECT = /^\s*\[?fyi\b/i;

// ---------------------------------------------------------------------------------------------
// Berlin clock
// ---------------------------------------------------------------------------------------------

const berlinFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function berlinParts(d: Date): { date: string; hour: number; minute: number } {
  const p = Object.fromEntries(berlinFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), minute: Number(p.minute) };
}

export function berlinDate(d: Date): string {
  return berlinParts(d).date;
}

/** UTC instant of a Berlin wall-clock time (CET or CEST). */
export function berlinWallToUtc(date: string, hour = 0, minute = 0): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  for (const off of [1, 2]) {
    const t = new Date(Date.UTC(y, m - 1, d, hour - off, minute));
    const p = berlinParts(t);
    if (p.date === date && p.hour === hour && p.minute === minute) return t;
  }
  throw new Error(`no Berlin instant for ${date} ${hour}:${minute}`);
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function inBatchWindow(now: Date): boolean {
  const { hour } = berlinParts(now);
  return hour >= BATCH_WINDOW_START_HOUR && hour < BATCH_WINDOW_END_HOUR;
}

// ---------------------------------------------------------------------------------------------
// Gate (AC3)
// ---------------------------------------------------------------------------------------------

export type GateRow = {
  id: string;
  createdAt: Date;
  fromAgent: string;
  toAgent: string;
  subject: string;
  bodyLength: number;
  urgencyClaim: UrgencyClaim;
  urgencyReason: string | null;
  deadlineAt: Date | null;
  blocks: string | null;
  dedupeKey: string;
  batchId: string | null;
  dispatchedAt: Date | null;
  gateDecision: string | null;
};

export type Action = 'wake' | 'batch' | 'suppress';
export type Decision = { action: Action; reason: string; notes: string[] };

export function normaliseAgent(raw: string): string {
  const id = raw.trim().toLowerCase();
  return AGENT_ALIASES[id] ?? id;
}

/** Reason code = leading token before ':' (or the whole reason if it is one token). */
export function reasonCode(reason: string | null | undefined): string | null {
  const m = /^\s*([a-z0-9_]+)\s*(:|$)/i.exec(reason ?? '');
  return m ? m[1]!.toLowerCase() : null;
}

export function knownBlockedParties(blocks: string | null | undefined): string[] {
  return (blocks ?? '')
    .split(/[\s,;/]+/)
    .map((p) => normaliseAgent(p.replace(/[^a-z0-9_]/gi, '')))
    .filter((p) => KNOWN_PARTIES.has(p));
}

export function isAck(row: Pick<GateRow, 'subject' | 'bodyLength'>): boolean {
  return ACK_SUBJECT.test(row.subject.trim()) && row.bodyLength <= ACK_BODY_MAX;
}

export function classify(row: GateRow, now: Date): Decision {
  const notes: string[] = [];
  const code = reasonCode(row.urgencyReason);
  const from = normaliseAgent(row.fromAgent);

  // (a) Logan, or LDW relaying a Logan order or decision.
  if (from === LOGAN) return { action: 'wake', reason: 'logan', notes };
  if (from === LDW && code && (LOGAN_RELAY_CODES as readonly string[]).includes(code)) {
    return { action: 'wake', reason: 'logan_relay', notes };
  }

  // Claims (b) and (d); a claim that fails its test is ignored and logged.
  if (row.urgencyClaim !== 'none') {
    if (!row.urgencyReason?.trim()) {
      notes.push('downgrade:missing_reason');
    } else if (row.urgencyClaim === 'blocking') {
      if (knownBlockedParties(row.blocks).length > 0) {
        return { action: 'wake', reason: 'blocking', notes };
      }
      notes.push('downgrade:blocks_unknown');
    } else if (row.urgencyClaim === 'urgent') {
      if (code && (URGENT_REASON_CODES as readonly string[]).includes(code)) {
        if (code !== 'deadline_6h') return { action: 'wake', reason: `urgent_${code}`, notes };
        const left = row.deadlineAt ? row.deadlineAt.getTime() - now.getTime() : NaN;
        if (left >= 0 && left <= DEADLINE_SOON_MS) {
          return { action: 'wake', reason: 'urgent_deadline_6h', notes };
        }
        notes.push('downgrade:deadline_not_within_6h');
      } else {
        notes.push('downgrade:reason_not_allowlisted');
      }
    } else if (row.urgencyClaim === 'deadline_today') {
      if (!row.deadlineAt) {
        notes.push('downgrade:no_deadline_at');
      } else if (berlinDate(row.deadlineAt) !== berlinDate(now)) {
        notes.push('downgrade:deadline_not_today');
      }
    }
  }

  // (c) deadline today (Berlin). Only queued rows reach the gate, so "not already done" holds.
  if (row.deadlineAt && berlinDate(row.deadlineAt) === berlinDate(now)) {
    return { action: 'wake', reason: 'deadline_today', notes };
  }

  if (isAck(row)) return { action: 'suppress', reason: 'ack', notes };
  if (FYI_SUBJECT.test(row.subject)) return { action: 'batch', reason: 'fyi', notes };
  return { action: 'batch', reason: 'default', notes };
}

export function formatDecision(d: Decision): string {
  return [`${d.action}:${d.reason}`, ...d.notes].join(';');
}

/** AC3: a newer queued item on the same dedupe_key supersedes every older queued one. */
export function supersededIds(rows: Array<Pick<GateRow, 'id' | 'createdAt' | 'dedupeKey'>>): string[] {
  const newest = new Map<string, { id: string; t: number }>();
  for (const r of rows) {
    const t = r.createdAt.getTime();
    const cur = newest.get(r.dedupeKey);
    if (!cur || t > cur.t || (t === cur.t && r.id > cur.id)) newest.set(r.dedupeKey, { id: r.id, t });
  }
  return rows.filter((r) => newest.get(r.dedupeKey)!.id !== r.id).map((r) => r.id);
}

// ---------------------------------------------------------------------------------------------
// Batching (AC4)
// ---------------------------------------------------------------------------------------------

export type Dispatch = {
  to: string;
  kind: 'wake' | 'batch';
  itemIds: string[];
  reason: string;
};
export type Skip = {
  to: string;
  why: 'no_hook' | 'outside_window' | 'cadence';
  items: number;
};

/** Rows not yet POSTed, or POSTed 2 h+ ago and still not marked delivered (A4). */
export function isPending(row: Pick<GateRow, 'dispatchedAt'>, now: Date): boolean {
  return (
    !row.dispatchedAt || now.getTime() - row.dispatchedAt.getTime() >= BATCH_INTERVAL_MS
  );
}

export function planDispatch(opts: {
  rows: GateRow[];
  decisions: Map<string, Decision>;
  lastDispatch: Map<string, Date>;
  hooks: ReadonlySet<string>;
  now: Date;
}): { dispatches: Dispatch[]; skips: Skip[] } {
  const { rows, decisions, lastDispatch, hooks, now } = opts;
  const byTo = new Map<string, GateRow[]>();
  for (const r of rows) {
    const d = decisions.get(r.id);
    if (!d || d.action === 'suppress' || !isPending(r, now)) continue;
    const list = byTo.get(r.toAgent) ?? [];
    list.push(r);
    byTo.set(r.toAgent, list);
  }
  const dispatches: Dispatch[] = [];
  const skips: Skip[] = [];
  for (const to of [...byTo.keys()].sort()) {
    const list = byTo
      .get(to)!
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
    if (!hooks.has(to)) {
      skips.push({ to, why: 'no_hook', items: list.length });
      continue;
    }
    const wakeReasons = [
      ...new Set(list.map((r) => decisions.get(r.id)!).filter((d) => d.action === 'wake').map((d) => d.reason)),
    ];
    const itemIds = list.map((r) => r.id);
    if (wakeReasons.length > 0) {
      // AC4: an urgent wake carries everything queued for that recipient.
      dispatches.push({ to, kind: 'wake', itemIds, reason: wakeReasons.join(',') });
      continue;
    }
    if (!inBatchWindow(now)) {
      skips.push({ to, why: 'outside_window', items: list.length });
      continue;
    }
    const last = lastDispatch.get(to);
    if (last && now.getTime() - last.getTime() < BATCH_INTERVAL_MS) {
      skips.push({ to, why: 'cadence', items: list.length });
      continue;
    }
    dispatches.push({ to, kind: 'batch', itemIds, reason: 'batch' });
  }
  return { dispatches, skips };
}

// ---------------------------------------------------------------------------------------------
// Config (names only; values never logged)
// ---------------------------------------------------------------------------------------------

export type Hook = { url: string; key: string };
export type WatchmanConfig = {
  hooks: Map<string, Hook>;
  keyHeader: string;
  keyScheme: string;
  errors: string[];
};

export function hookEnvNames(agent: string): { url: string; key: string } {
  const a = agent.toUpperCase();
  return { url: `WATCHMAN_HOOK_${a}_URL`, key: `WATCHMAN_HOOK_${a}_KEY` };
}

export function parseConfig(env: Record<string, string | undefined>): WatchmanConfig {
  const errors: string[] = [];
  const hooks = new Map<string, Hook>();
  const agents = (env.WATCHMAN_AGENTS ?? '')
    .split(',')
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);
  if (agents.length === 0) errors.push('WATCHMAN_AGENTS is empty');
  for (const a of agents) {
    if (!(AGENT_IDS as readonly string[]).includes(a)) {
      errors.push(`WATCHMAN_AGENTS names an unknown agent id (${a.replace(/[^a-z0-9_]/g, '?')})`);
      continue;
    }
    const n = hookEnvNames(a);
    const url = env[n.url]?.trim();
    const key = env[n.key]?.trim();
    if (!url) errors.push(`${n.url} is not set`);
    else if (!url.startsWith('https://')) errors.push(`${n.url} is not an https URL`);
    if (!key) errors.push(`${n.key} is not set`);
    if (url && key && url.startsWith('https://')) hooks.set(a, { url, key });
  }
  const keyHeader = env.WATCHMAN_KEY_HEADER?.trim() || 'Authorization';
  const scheme = env.WATCHMAN_KEY_SCHEME;
  const keyScheme = scheme === undefined ? 'Bearer' : scheme.trim();
  if (!/^[A-Za-z0-9-]+$/.test(keyHeader)) errors.push('WATCHMAN_KEY_HEADER is not a header name');
  return { hooks, keyHeader, keyScheme, errors };
}

/** Removes every hook URL and key from a string (belt and braces for error text). */
export function redact(text: string, hooks: Map<string, Hook>): string {
  let out = text;
  for (const h of hooks.values()) {
    for (const v of [h.url, h.key]) if (v) out = out.split(v).join('[redacted]');
  }
  return out.replace(/https?:\/\/\S+/g, '[url]').replace(/postgres(ql)?:\/\/\S+/g, '[db-url]');
}

// ---------------------------------------------------------------------------------------------
// Delivery (AC5)
// ---------------------------------------------------------------------------------------------

export type FetchLike = (
  _url: string,
  _init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }
) => Promise<{ ok: boolean; status: number }>;

export type WebhookPayload = {
  to_agent: string;
  batch_id: string;
  item_ids: string[];
  reason: string;
};

export async function postWebhook(
  fetchFn: FetchLike,
  hook: Hook,
  cfg: Pick<WatchmanConfig, 'keyHeader' | 'keyScheme'>,
  payload: WebhookPayload,
  timeoutMs = 15_000
): Promise<{ ok: boolean; status: string }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchFn(hook.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [cfg.keyHeader]: cfg.keyScheme ? `${cfg.keyScheme} ${hook.key}` : hook.key,
      },
      body: JSON.stringify(payload),
      signal: ctl.signal,
    });
    return { ok: res.ok, status: `http_${res.status}` };
  } catch (e) {
    const name = (e as { name?: string })?.name;
    return { ok: false, status: name === 'AbortError' ? 'timeout' : 'network_error' };
  } finally {
    clearTimeout(timer);
  }
}

export function makeBatchId(kind: 'wake' | 'batch', to: string, now: Date, rand: string): string {
  const p = berlinParts(now);
  const stamp = `${p.date.replace(/-/g, '')}T${String(p.hour).padStart(2, '0')}${String(p.minute).padStart(2, '0')}`;
  return `${kind}-${to}-${stamp}-${rand}`;
}

// ---------------------------------------------------------------------------------------------
// Neon access (ids passed as one comma-joined text so neon(), postgres() and PGlite agree)
// ---------------------------------------------------------------------------------------------

type RawRow = {
  id: string;
  created_at: Date | string;
  from_agent: string;
  to_agent: string;
  subject: string;
  body_length: number | string;
  urgency_claim: UrgencyClaim;
  urgency_reason: string | null;
  deadline_at: Date | string | null;
  blocks: string | null;
  dedupe_key: string;
  batch_id: string | null;
  dispatched_at: Date | string | null;
  gate_decision: string | null;
};

const toDate = (v: Date | string | null): Date | null => (v === null ? null : new Date(v));

export async function readQueued(sql: DabosSql): Promise<GateRow[]> {
  const rows = (await sql`
    SELECT id, created_at, from_agent, to_agent, subject, length(body) AS body_length,
           urgency_claim, urgency_reason, deadline_at, blocks, dedupe_key, batch_id,
           dispatched_at, gate_decision
      FROM agent_inbox
     WHERE status = 'queued'
     ORDER BY created_at, id
  `) as RawRow[];
  return rows.map((r) => ({
    id: r.id,
    createdAt: new Date(r.created_at),
    fromAgent: r.from_agent,
    toAgent: r.to_agent,
    subject: r.subject,
    bodyLength: Number(r.body_length),
    urgencyClaim: r.urgency_claim,
    urgencyReason: r.urgency_reason,
    deadlineAt: toDate(r.deadline_at),
    blocks: r.blocks,
    dedupeKey: r.dedupe_key,
    batchId: r.batch_id,
    dispatchedAt: toDate(r.dispatched_at),
    gateDecision: r.gate_decision,
  }));
}

export async function readLastDispatch(sql: DabosSql): Promise<Map<string, Date>> {
  const rows = (await sql`
    SELECT to_agent, max(dispatched_at) AS last FROM agent_inbox
     WHERE dispatched_at IS NOT NULL GROUP BY to_agent
  `) as Array<{ to_agent: string; last: Date | string }>;
  return new Map(rows.map((r) => [r.to_agent, new Date(r.last)]));
}

export async function markSuperseded(sql: DabosSql, ids: string[], now: Date): Promise<number> {
  if (ids.length === 0) return 0;
  const r = (await sql`
    UPDATE agent_inbox SET status = 'superseded', gate_decision = 'superseded', gated_at = ${now.toISOString()}::timestamptz
     WHERE status = 'queued' AND id = ANY (string_to_array(${ids.join(',')}, ',')::uuid[])
    RETURNING id
  `) as unknown[];
  return r.length;
}

export async function recordDecision(
  sql: DabosSql,
  decision: string,
  ids: string[],
  now: Date
): Promise<void> {
  if (ids.length === 0) return;
  const status = decision.startsWith('suppress:') ? 'suppressed' : 'queued';
  await sql`
    UPDATE agent_inbox SET gate_decision = ${decision}, gated_at = ${now.toISOString()}::timestamptz, status = ${status}
     WHERE status = 'queued' AND id = ANY (string_to_array(${ids.join(',')}, ',')::uuid[])
  `;
}

export async function claimBatch(
  sql: DabosSql,
  batchId: string,
  ids: string[],
  now: Date
): Promise<string[]> {
  const r = (await sql`
    UPDATE agent_inbox SET batch_id = ${batchId}, dispatched_at = ${now.toISOString()}::timestamptz
     WHERE status = 'queued' AND id = ANY (string_to_array(${ids.join(',')}, ',')::uuid[])
    RETURNING id
  `) as Array<{ id: string }>;
  return r.map((x) => x.id).sort();
}

export async function releaseBatch(sql: DabosSql, batchId: string): Promise<void> {
  await sql`
    UPDATE agent_inbox SET batch_id = NULL, dispatched_at = NULL
     WHERE batch_id = ${batchId} AND status = 'queued'
  `;
}

/** A5: one failure row per kind per Berlin day to div4. Body text is stable for the day (no counts,
 * no times) so repeats are dropped by the unique key; counts go to the journal only. */
export async function fileFailure(
  sql: DabosSql,
  kind: string,
  detail: string,
  now: Date
): Promise<void> {
  const day = berlinDate(now);
  const body =
    `Owner post: ${FAILURE_OWNER}. Watchman failure "${kind}" on ${day}. ${detail} ` +
    `Counts and times: journalctl --user -u dabos-watchman -n 50 on ln02.`;
  await sql`
    INSERT INTO agent_inbox (from_agent, to_agent, subject, body, urgency_claim, urgency_reason, dedupe_key)
    VALUES (${WATCHMAN_SENDER}, ${FAILURE_RECIPIENT}, ${`Watchman failure: ${kind}`}, ${body}, 'none', NULL,
            ${`watchman:failure:${kind}:${day}`})
    ON CONFLICT ON CONSTRAINT agent_inbox_dedupe_content_uq DO NOTHING
  `;
}

// ---------------------------------------------------------------------------------------------
// Metrics (AC7)
// ---------------------------------------------------------------------------------------------

export type DailyMetrics = {
  day: string;
  items: number;
  wakes: number;
  batches: number;
  woken_items: number;
  batched_items: number;
  suppressed: number;
  superseded: number;
  downgraded: number;
  delivered: number;
};

export async function writeDailyMetrics(
  sql: DabosSql,
  day: string
): Promise<'written' | 'exists'> {
  const exists = (await sql`
    SELECT 1 FROM role_runs WHERE role_id = ${METRICS_ROLE_ID} AND summary_json->>'day' = ${day} LIMIT 1
  `) as unknown[];
  if (exists.length > 0) return 'exists';
  const from = berlinWallToUtc(day).toISOString();
  const to = berlinWallToUtc(addDays(day, 1)).toISOString();
  const [c] = (await sql`
    SELECT
      count(*) FILTER (WHERE created_at >= ${from}::timestamptz AND created_at < ${to}::timestamptz) AS items,
      count(DISTINCT batch_id) FILTER (WHERE batch_id LIKE 'wake-%' AND dispatched_at >= ${from}::timestamptz AND dispatched_at < ${to}::timestamptz) AS wakes,
      count(DISTINCT batch_id) FILTER (WHERE batch_id LIKE 'batch-%' AND dispatched_at >= ${from}::timestamptz AND dispatched_at < ${to}::timestamptz) AS batches,
      count(*) FILTER (WHERE batch_id LIKE 'wake-%' AND dispatched_at >= ${from}::timestamptz AND dispatched_at < ${to}::timestamptz) AS woken_items,
      count(*) FILTER (WHERE batch_id LIKE 'batch-%' AND dispatched_at >= ${from}::timestamptz AND dispatched_at < ${to}::timestamptz) AS batched_items,
      count(*) FILTER (WHERE status = 'suppressed' AND created_at >= ${from}::timestamptz AND created_at < ${to}::timestamptz) AS suppressed,
      count(*) FILTER (WHERE status = 'superseded' AND created_at >= ${from}::timestamptz AND created_at < ${to}::timestamptz) AS superseded,
      count(*) FILTER (WHERE gate_decision LIKE '%downgrade:%' AND created_at >= ${from}::timestamptz AND created_at < ${to}::timestamptz) AS downgraded,
      count(*) FILTER (WHERE delivered_at >= ${from}::timestamptz AND delivered_at < ${to}::timestamptz) AS delivered
    FROM agent_inbox
  `) as Array<Record<string, number | string>>;
  const m: DailyMetrics = {
    day,
    items: Number(c!.items),
    wakes: Number(c!.wakes),
    batches: Number(c!.batches),
    woken_items: Number(c!.woken_items),
    batched_items: Number(c!.batched_items),
    suppressed: Number(c!.suppressed),
    superseded: Number(c!.superseded),
    downgraded: Number(c!.downgraded),
    delivered: Number(c!.delivered),
  };
  await sql`
    INSERT INTO role_runs (role_id, role_type, summary_json)
    VALUES (${METRICS_ROLE_ID}, 'cadence', ${JSON.stringify(m)}::jsonb)
  `;
  return 'written';
}

// ---------------------------------------------------------------------------------------------
// One tick
// ---------------------------------------------------------------------------------------------

export type TickResult = {
  queued: number;
  superseded: number;
  suppressed: number;
  wakes: number;
  batches: number;
  skips: Skip[];
  failures: Array<{ kind: string; detail: string }>;
  metrics: 'written' | 'exists' | 'skipped' | 'failed';
  dryRun: boolean;
};

export async function runTick(deps: {
  sql: DabosSql;
  fetchFn: FetchLike;
  config: WatchmanConfig;
  now: Date;
  dryRun: boolean;
  log: (_line: string) => void;
  randomId?: () => string;
}): Promise<TickResult> {
  const { sql, fetchFn, config, now, dryRun, log } = deps;
  const rand = deps.randomId ?? (() => Math.random().toString(36).slice(2, 8));
  const failures: TickResult['failures'] = [];
  const result: TickResult = {
    queued: 0,
    superseded: 0,
    suppressed: 0,
    wakes: 0,
    batches: 0,
    skips: [],
    failures,
    metrics: 'skipped',
    dryRun,
  };
  const tag = dryRun ? '[dry run] ' : '';

  const rows = await readQueued(sql);
  result.queued = rows.length;

  const sup = new Set(supersededIds(rows));
  if (sup.size) {
    for (const id of sup) log(`${tag}item=${id} decision=superseded`);
    if (!dryRun) await markSuperseded(sql, [...sup], now);
  }
  result.superseded = sup.size;

  const live = rows.filter((r) => !sup.has(r.id));
  const decisions = new Map<string, Decision>();
  const changed = new Map<string, string[]>();
  for (const r of live) {
    const d = classify(r, now);
    decisions.set(r.id, d);
    const text = formatDecision(d);
    if (text !== r.gateDecision) {
      changed.set(text, [...(changed.get(text) ?? []), r.id]);
      log(`${tag}item=${r.id} to=${r.toAgent} decision=${text}`);
    }
    if (d.action === 'suppress') result.suppressed++;
  }
  if (!dryRun) for (const [text, ids] of changed) await recordDecision(sql, text, ids, now);

  const lastDispatch = await readLastDispatch(sql);
  const plan = planDispatch({
    rows: live,
    decisions,
    lastDispatch,
    hooks: new Set(config.hooks.keys()),
    now,
  });
  result.skips = plan.skips;
  for (const s of plan.skips) {
    log(`${tag}hold to=${s.to} items=${s.items} why=${s.why}`);
    if (s.why === 'no_hook') {
      failures.push({ kind: `no_hook_${s.to}`, detail: `Items for ${s.to} cannot be delivered: no webhook configured in watchman.env.` });
    }
  }

  for (const d of plan.dispatches) {
    const batchId = makeBatchId(d.kind, d.to, now, rand());
    if (dryRun) {
      log(`${tag}would dispatch kind=${d.kind} to=${d.to} items=${d.itemIds.length} reason=${d.reason}`);
      if (d.kind === 'wake') result.wakes++;
      else result.batches++;
      continue;
    }
    const claimed = await claimBatch(sql, batchId, d.itemIds, now);
    if (claimed.length === 0) continue;
    const res = await postWebhook(fetchFn, config.hooks.get(d.to)!, config, {
      to_agent: d.to,
      batch_id: batchId,
      item_ids: claimed,
      reason: d.reason,
    });
    log(`dispatch kind=${d.kind} to=${d.to} batch=${batchId} items=${claimed.length} reason=${d.reason} result=${res.ok ? 'ok' : res.status}`);
    if (res.ok) {
      if (d.kind === 'wake') result.wakes++;
      else result.batches++;
    } else {
      await releaseBatch(sql, batchId);
      failures.push({ kind: `post_failed_${d.to}`, detail: `POST to ${d.to}'s routine failed (${res.status}); its items stay queued and are retried each tick.` });
    }
  }

  if (!dryRun) {
    try {
      result.metrics = await writeDailyMetrics(sql, addDays(berlinDate(now), -1));
    } catch (e) {
      result.metrics = 'failed';
      failures.push({ kind: 'metrics_failed', detail: 'Daily metrics row could not be written to role_runs.' });
      log(`metrics failed (${redact(errorText(e), config.hooks)})`);
    }
    for (const f of failures) {
      try {
        await fileFailure(sql, f.kind, f.detail, now);
      } catch (e) {
        log(`failure row not filed kind=${f.kind} (${redact(errorText(e), config.hooks)})`);
      }
    }
  }

  log(
    `${tag}tick ${now.toISOString()} queued=${result.queued} superseded=${result.superseded} suppressed=${result.suppressed} ` +
      `wakes=${result.wakes} batches=${result.batches} holds=${result.skips.length} failures=${failures.length} metrics=${result.metrics}`
  );
  return result;
}

export function errorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.slice(0, 300);
}

// ---------------------------------------------------------------------------------------------
// Failure state (Dept13 rule 4: only a full clean run of the same scope clears it)
// ---------------------------------------------------------------------------------------------

export type FailureState = {
  open: Array<{ kind: string; since: string; lastSeen: string; owner: string }>;
  lastCleanFullRun: string | null;
};

export function nextFailureState(
  prev: FailureState,
  tick: { now: Date; dryRun: boolean; complete: boolean; failureKinds: string[] }
): FailureState {
  const at = tick.now.toISOString();
  const open = prev.open.map((f) => ({ ...f }));
  for (const kind of tick.failureKinds) {
    const cur = open.find((f) => f.kind === kind);
    if (cur) cur.lastSeen = at;
    else open.push({ kind, since: at, lastSeen: at, owner: FAILURE_OWNER });
  }
  const clean = !tick.dryRun && tick.complete && tick.failureKinds.length === 0;
  if (clean) return { open: [], lastCleanFullRun: at };
  return { open, lastCleanFullRun: prev.lastCleanFullRun };
}
