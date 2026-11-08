/**
 * RR-010 step 3: one Div1–7 status digest (read, not sent).
 *
 * Pure builder + small fetchers with injected dependencies (sql tag, fetch, command runner) so every
 * part is testable without network, Neon or systemd. The runner lives in scripts/dabos/status-digest.ts.
 *
 * Safety:
 * - tasks are counted, never listed (no titles or descriptions: DVAG client data stays out).
 * - systemd is asked only for unit names and state properties, never ExecStart or command lines.
 * - no secret is read here; callers pass the token in.
 */
import type { DabosSql } from '@/lib/dabos/dabos-connection';
import {
  buildOpenOrdersSection,
  readOpenOrders,
  type OpenOrderLine,
} from '@/lib/dabos/build-receipt';
import { closedOrgWeek, type OrgStatWeek } from '@/lib/dabos/org-week';

export const DIVISIONS = ['Div1', 'Div2', 'Div3', 'Div4', 'Div5', 'Div6', 'Div7'] as const;
export type DivisionId = (typeof DIVISIONS)[number];
export const UNASSIGNED = 'Unassigned';
export type DivisionKey = DivisionId | typeof UNASSIGNED;

export const DIGEST_REPOS = ['A-sop/DABOS', 'A-sop/logans-tools'] as const;
export const DIGEST_ROLE_ID = 'status_digest';
export const MERGED_WINDOW_HOURS = 24;

/** Dept N → Div: Div1 Dept1–3, Div2 Dept4–6, … Div7 Dept19–21. */
export function divisionForDepartment(dept: number): DivisionId | null {
  if (!Number.isInteger(dept) || dept < 1 || dept > 21) return null;
  return `Div${Math.ceil(dept / 3)}` as DivisionId;
}

/** Normalise `div4`, `DIV4`, `Div 4`, `Dept10`, `dept10` to a division key. */
export function normaliseDivision(raw: string | null | undefined): DivisionKey {
  if (!raw) return UNASSIGNED;
  const div = /^\s*div\s*([1-7])\s*$/i.exec(raw);
  if (div) return `Div${div[1]}` as DivisionId;
  const dept = /^\s*dept\s*(\d{1,2})\s*$/i.exec(raw);
  if (dept) return divisionForDepartment(Number(dept[1])) ?? UNASSIGNED;
  return UNASSIGNED;
}

/** Division from a PR title: first `Div N` wins, else first `Dept N`, else Unassigned. */
export function divisionFromTitle(title: string): DivisionKey {
  const div = /\bDiv\s?([1-7])\b/i.exec(title);
  if (div) return `Div${div[1]}` as DivisionId;
  const dept = /\bDept\s?(\d{1,2})\b/i.exec(title);
  if (dept) return divisionForDepartment(Number(dept[1])) ?? UNASSIGNED;
  return UNASSIGNED;
}

// ---------------------------------------------------------------------------------------------
// GitHub
// ---------------------------------------------------------------------------------------------

/** Dept13 verdicts are PASS or FAIL only. */
export type Dept13Verdict = 'PASS' | 'FAIL';
export type VerdictLine = { verdict: Dept13Verdict; sha: string; at: string };

/** A full 40-hex git sha (GitHub returns lowercase). */
export const FULL_SHA_RE = /^[0-9a-f]{40}$/;

/**
 * The whole FIRST line of the body, exactly `Dept13 PASS @<40hex>` or `Dept13 FAIL @<40hex>`.
 * Anchored at both ends: no markdown, no text between the verdict and `@`, no short or long sha.
 */
export const VERDICT_LINE_RE = /^Dept13 (PASS|FAIL) @([0-9a-f]{40})$/;

/**
 * The Dept13 verdict of a review or comment body. Only the first line is read (a CRLF line end is
 * allowed); a verdict on any later line is not a verdict.
 */
export function parseDept13Verdict(
  body: string | null | undefined
): Omit<VerdictLine, 'at'> | null {
  if (!body) return null;
  const nl = body.indexOf('\n');
  const first = (nl === -1 ? body : body.slice(0, nl)).replace(/\r$/, '');
  const m = VERDICT_LINE_RE.exec(first);
  if (!m) return null;
  return { verdict: m[1] as Dept13Verdict, sha: m[2]! };
}

/** Latest verdict across reviews and comments (by timestamp). */
export function latestVerdict(
  items: Array<{ body?: string | null; at?: string | null }>
): VerdictLine | null {
  let best: VerdictLine | null = null;
  for (const it of items) {
    const v = parseDept13Verdict(it.body);
    if (!v || !it.at) continue;
    if (!best || it.at > best.at) best = { ...v, at: it.at };
  }
  return best;
}

/** Current only when both are full 40-hex shas and equal. Never truncates, never prefix-matches. */
export function shaMatches(verdictSha: string, headSha: string): boolean {
  if (typeof verdictSha !== 'string' || typeof headSha !== 'string') return false;
  const head = headSha.toLowerCase();
  return FULL_SHA_RE.test(verdictSha) && FULL_SHA_RE.test(head) && verdictSha === head;
}

export type PrSummary = {
  repo: string;
  number: number;
  title: string;
  url: string;
  state: 'open' | 'merged';
  draft: boolean;
  headSha: string;
  updatedAt: string;
  mergedAt: string | null;
  division: DivisionKey;
  dept13: (VerdictLine & { current: boolean }) | null;
};

type GhPull = {
  number: number;
  title: string;
  html_url: string;
  draft?: boolean;
  merged_at?: string | null;
  updated_at: string;
  head: { sha: string };
};
type GhReview = { body?: string | null; submitted_at?: string | null };
type GhComment = { body?: string | null; created_at?: string | null; updated_at?: string | null };

export type FetchLike = (
  _url: string,
  _init?: { method?: string; headers?: Record<string, string>; body?: string }
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text?: () => Promise<string>;
}>;

async function ghGet<T>(fetchFn: FetchLike, token: string, path: string): Promise<T> {
  const res = await fetchFn(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'dabos-status-digest',
    },
  });
  // Status only: never echo the request headers or the response body.
  if (!res.ok) throw new Error(`GitHub ${path.split('?')[0]} -> HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function fetchRepoPulls(opts: {
  fetchFn: FetchLike;
  token: string;
  repo: string;
  now: Date;
}): Promise<PrSummary[]> {
  const { fetchFn, token, repo, now } = opts;
  const open = await ghGet<GhPull[]>(
    fetchFn,
    token,
    `/repos/${repo}/pulls?state=open&per_page=100`
  );
  const closed = await ghGet<GhPull[]>(
    fetchFn,
    token,
    `/repos/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=50`
  );
  const since = now.getTime() - MERGED_WINDOW_HOURS * 3600_000;
  const merged = closed.filter((p) => p.merged_at && Date.parse(p.merged_at) >= since);

  const out: PrSummary[] = [];
  for (const p of open) {
    const reviews = await ghGet<GhReview[]>(
      fetchFn,
      token,
      `/repos/${repo}/pulls/${p.number}/reviews?per_page=100`
    );
    const comments = await ghGet<GhComment[]>(
      fetchFn,
      token,
      `/repos/${repo}/issues/${p.number}/comments?per_page=100`
    );
    const v = latestVerdict([
      ...reviews.map((r) => ({ body: r.body, at: r.submitted_at })),
      ...comments.map((c) => ({ body: c.body, at: c.updated_at ?? c.created_at })),
    ]);
    out.push({
      repo,
      number: p.number,
      title: p.title,
      url: p.html_url,
      state: 'open',
      draft: Boolean(p.draft),
      headSha: p.head.sha,
      updatedAt: p.updated_at,
      mergedAt: null,
      division: divisionFromTitle(p.title),
      dept13: v ? { ...v, current: shaMatches(v.sha, p.head.sha) } : null,
    });
  }
  for (const p of merged) {
    out.push({
      repo,
      number: p.number,
      title: p.title,
      url: p.html_url,
      state: 'merged',
      draft: false,
      headSha: p.head.sha,
      updatedAt: p.updated_at,
      mergedAt: p.merged_at ?? null,
      division: divisionFromTitle(p.title),
      dept13: null,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Neon (read-only queries; the only write is insertDigestRow)
// ---------------------------------------------------------------------------------------------

export type TaskCount = { division: DivisionKey; status: string; basket: string | null; n: number };

export async function readTaskCounts(sql: DabosSql): Promise<TaskCount[]> {
  const rows = (await sql`
    SELECT division_id, department_id, status, basket, count(*)::int AS n
    FROM tasks
    WHERE status NOT IN ('done', 'cancelled')
    GROUP BY division_id, department_id, status, basket
  `) as Array<{
    division_id: string | null;
    department_id: string | null;
    status: string;
    basket: string | null;
    n: number;
  }>;
  const merged = new Map<string, TaskCount>();
  for (const r of rows) {
    let division = normaliseDivision(r.division_id);
    if (division === UNASSIGNED) division = normaliseDivision(r.department_id);
    const key = `${division}|${r.status}|${r.basket ?? ''}`;
    const prev = merged.get(key);
    if (prev) prev.n += Number(r.n);
    else merged.set(key, { division, status: r.status, basket: r.basket, n: Number(r.n) });
  }
  return [...merged.values()];
}

export type PendingApproval = {
  id: string;
  kind: string;
  title: string;
  createdAt: string;
  division: DivisionKey;
};

export async function readPendingApprovals(sql: DabosSql): Promise<PendingApproval[]> {
  const rows = (await sql`
    SELECT id::text AS id, kind, title, division_id, department_id, created_at
    FROM approval_queue
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT 50
  `) as Array<{
    id: string;
    kind: string;
    title: string;
    division_id: string | null;
    department_id: string | null;
    created_at: Date | string;
  }>;
  return rows.map((r) => {
    let division = normaliseDivision(r.division_id);
    if (division === UNASSIGNED) division = normaliseDivision(r.department_id);
    return { id: r.id, kind: r.kind, title: r.title, createdAt: toIso(r.created_at), division };
  });
}

export type StatsPosted = Record<DivisionId, number>;

/** Live (not superseded) stat rows per division whose workspace_id ends in `-<YYYY-Www>`. */
export async function readStatsPosted(sql: DabosSql, week: OrgStatWeek): Promise<StatsPosted> {
  const suffix = `%-${week.id}`;
  const rows = (await sql`
    SELECT division_id, count(*)::int AS n
    FROM stats
    WHERE superseded_at IS NULL AND workspace_id LIKE ${suffix}
    GROUP BY division_id
  `) as Array<{ division_id: string; n: number }>;
  const out = Object.fromEntries(DIVISIONS.map((d) => [d, 0])) as StatsPosted;
  for (const r of rows) {
    const d = normaliseDivision(r.division_id);
    if (d !== UNASSIGNED) out[d] += Number(r.n);
  }
  return out;
}

export type CadenceRun = { roleId: string; ranAt: string };

export async function readLatestCadenceRuns(sql: DabosSql): Promise<CadenceRun[]> {
  const rows = (await sql`
    SELECT DISTINCT ON (role_id) role_id, ran_at
    FROM role_runs
    WHERE role_type = 'cadence'
    ORDER BY role_id, ran_at DESC
  `) as Array<{ role_id: string; ran_at: Date | string }>;
  return rows.map((r) => ({ roleId: r.role_id, ranAt: toIso(r.ran_at) }));
}

export async function insertDigestRow(sql: DabosSql, digest: StatusDigest): Promise<void> {
  const summary = JSON.stringify({ ...digest.json, markdown: digest.markdown });
  await sql`
    INSERT INTO role_runs (role_id, role_type, summary_json)
    VALUES (${DIGEST_ROLE_ID}, 'cadence', ${summary}::jsonb)
  `;
}

// ---------------------------------------------------------------------------------------------
// systemd (user units on ln02)
// ---------------------------------------------------------------------------------------------

export type RunCommand = (_cmd: string, _args: string[]) => Promise<string>;

/** Properties requested from systemd. Never ExecStart / command lines. */
export const TIMER_PROPS = [
  'Id',
  'ActiveState',
  'SubState',
  'Result',
  'LastTriggerUSec',
  'NextElapseUSecRealtime',
  'Unit',
];
export const SERVICE_PROPS = ['Id', 'ActiveState', 'SubState', 'Result', 'ExecMainStatus'];

export type TimerState = {
  id: string;
  activeState: string;
  subState: string;
  result: string;
  lastTrigger: string;
  next: string;
  unit: string;
  serviceResult: string | null;
  serviceExitStatus: string | null;
};

/** First column of `--plain --no-legend` output, without status bullets. */
export function parseUnitNames(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s●*×]+/, '').trim())
    .filter(Boolean)
    .map((l) => l.split(/\s+/)[0]!)
    .filter((n) => /^[A-Za-z0-9@_.:\\-]+$/.test(n));
}

/** Parse `systemctl show` output: blocks separated by blank lines, `Key=Value` lines. */
export function parseShowBlocks(output: string): Array<Record<string, string>> {
  const blocks: Array<Record<string, string>> = [];
  let cur: Record<string, string> = {};
  for (const line of output.split(/\r?\n/)) {
    if (!line.trim()) {
      if (Object.keys(cur).length) blocks.push(cur);
      cur = {};
      continue;
    }
    const i = line.indexOf('=');
    if (i > 0) cur[line.slice(0, i)] = line.slice(i + 1);
  }
  if (Object.keys(cur).length) blocks.push(cur);
  return blocks;
}

export async function readSystemdUserState(
  run: RunCommand,
  unitFilter?: RegExp
): Promise<{ timers: TimerState[]; failedUnits: string[] }> {
  const base = ['--user', '--no-pager'];
  let timerNames = parseUnitNames(
    await run('systemctl', [
      ...base,
      'list-units',
      '--all',
      '--type=timer',
      '--plain',
      '--no-legend',
    ])
  );
  if (unitFilter) timerNames = timerNames.filter((n) => unitFilter.test(n));
  const failedUnits = parseUnitNames(
    await run('systemctl', [...base, 'list-units', '--state=failed', '--plain', '--no-legend'])
  ).filter((n) => !unitFilter || unitFilter.test(n));

  if (!timerNames.length) return { timers: [], failedUnits };
  const timerBlocks = parseShowBlocks(
    await run('systemctl', [...base, 'show', ...timerNames, `--property=${TIMER_PROPS.join(',')}`])
  );
  const serviceNames = timerBlocks.map((b) => b.Unit).filter((u): u is string => Boolean(u));
  const serviceBlocks = serviceNames.length
    ? parseShowBlocks(
        await run('systemctl', [
          ...base,
          'show',
          ...serviceNames,
          `--property=${SERVICE_PROPS.join(',')}`,
        ])
      )
    : [];
  const svcById = new Map(serviceBlocks.map((b) => [b.Id, b]));
  const timers = timerBlocks.map((b) => {
    const svc = b.Unit ? svcById.get(b.Unit) : undefined;
    return {
      id: b.Id ?? '?',
      activeState: b.ActiveState ?? '?',
      subState: b.SubState ?? '?',
      result: b.Result ?? '?',
      lastTrigger: b.LastTriggerUSec || 'n/a',
      next: b.NextElapseUSecRealtime || 'n/a',
      unit: b.Unit ?? '',
      serviceResult: svc?.Result ?? null,
      serviceExitStatus: svc?.ExecMainStatus ?? null,
    };
  });
  return { timers, failedUnits };
}

// ---------------------------------------------------------------------------------------------
// ln02 checkout sync (logans-tools #59: ops/ln02/bin/dabos-checkout-sync.sh)
// ---------------------------------------------------------------------------------------------

/** Owner post for a failed checkout sync and for a failed, missing or stale digest. */
export const OWNER_POST = 'Dept12 Production (Div4)';
export const CHECKOUT_SYNC_FAIL_FILE = 'checkout-sync.FAIL';
export const CHECKOUT_SYNC_STATUS_FILE = 'checkout-sync.status.json';
const SYNC_OK_STATES = new Set(['ok', 'up_to_date']);

export type CheckoutSyncRepo = { repo: string; state: string; message: string };
export type CheckoutSyncState = {
  failFlag: boolean;
  failFlagText: string | null;
  lastRunState: string | null;
  endedAt: string | null;
  repos: CheckoutSyncRepo[];
  failingRepos: CheckoutSyncRepo[];
  statusError: string | null;
};

/** Reads a text file; resolves null when the file does not exist. */
export type ReadText = (_path: string) => Promise<string | null>;

function oneLine(v: unknown, max = 200): string {
  return String(v ?? '')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, max);
}

function repoName(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts[parts.length - 1] ?? p;
}

/** The FAIL flag and the status file in `dir` (ln02: ~/.local/state/dabos). Reads only those two. */
export async function readCheckoutSyncState(
  dir: string,
  readText: ReadText
): Promise<CheckoutSyncState> {
  const join = (f: string) => `${dir.replace(/[\\/]+$/, '')}/${f}`;
  const flag = await readText(join(CHECKOUT_SYNC_FAIL_FILE));
  const raw = await readText(join(CHECKOUT_SYNC_STATUS_FILE));
  const out: CheckoutSyncState = {
    failFlag: flag !== null,
    failFlagText: flag === null ? null : oneLine(flag) || null,
    lastRunState: null,
    endedAt: null,
    repos: [],
    failingRepos: [],
    statusError: null,
  };
  if (raw === null) {
    out.statusError = 'no status file';
    return out;
  }
  try {
    const j = JSON.parse(raw) as {
      state?: unknown;
      ended_at_utc?: unknown;
      repos?: Array<{ repo?: unknown; state?: unknown; message?: unknown }>;
    };
    out.lastRunState = j.state == null ? null : oneLine(j.state, 60);
    out.endedAt = j.ended_at_utc == null ? null : oneLine(j.ended_at_utc, 40);
    out.repos = (Array.isArray(j.repos) ? j.repos : []).map((r) => ({
      repo: repoName(oneLine(r.repo)),
      state: oneLine(r.state, 40),
      message: oneLine(r.message),
    }));
    out.failingRepos = out.repos.filter((r) => !SYNC_OK_STATES.has(r.state));
  } catch {
    out.statusError = 'status file is not valid JSON';
  }
  return out;
}

/** Alert lines for the digest: the FAIL flag, or an unreadable status. */
export function checkoutSyncAlerts(c: CheckoutSyncState | null): string[] {
  if (!c) return [];
  const out: string[] = [];
  if (c.failFlag) {
    const failing = c.failingRepos.length
      ? c.failingRepos.map((r) => `${r.repo} ${r.state}`).join(', ')
      : 'see checkout-sync.status.json';
    out.push(
      `${CHECKOUT_SYNC_FAIL_FILE} present (${failing}); owner ${OWNER_POST}`
    );
  } else if (c.statusError === 'status file is not valid JSON') {
    out.push(`${CHECKOUT_SYNC_STATUS_FILE} unreadable; owner ${OWNER_POST}`);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------------------------

export type DigestInput = {
  now: Date;
  host: string;
  week: OrgStatWeek;
  prs: PrSummary[] | null;
  tasks: TaskCount[] | null;
  approvals: PendingApproval[] | null;
  stats: StatsPosted | null;
  cadence: CadenceRun[] | null;
  systemd: { timers: TimerState[]; failedUnits: string[] } | null;
  checkoutSync: CheckoutSyncState | null;
  /** Open build orders (start → 24 h after finish). null = source unavailable. */
  openOrders: OpenOrderLine[] | null;
  sourceErrors: Array<{ source: string; error: string }>;
};

export type DivisionSummary = {
  division: DivisionKey;
  openPrs: number;
  needsDept13: number;
  readyForLogan: number;
  failedAtHead: number;
  mergedLast24h: number;
  openTasks: number;
  reassessTasks: number;
  pendingApprovals: number;
  statsPostedLastWeek: boolean | null;
};

export type StatusDigest = {
  markdown: string;
  json: {
    version: 1;
    generatedAt: string;
    host: string;
    week: string;
    divisions: DivisionSummary[];
    needsLogan: string[];
    needsDept13: string[];
    machineAlerts: string[];
    checkoutSync: CheckoutSyncState | null;
    openOrders: OpenOrderLine[] | null;
    ownerPost: string;
    sourceErrors: Array<{ source: string; error: string }>;
  };
};

export function berlinStamp(d: Date): string {
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

function toIso(v: Date | string): string {
  return v instanceof Date ? v.toISOString() : new Date(v).toISOString();
}

function prRef(p: PrSummary): string {
  const repo = p.repo.split('/')[1];
  return `${repo}#${p.number}`;
}

function prLine(p: PrSummary): string {
  const sha = p.headSha.slice(0, 8);
  let verdict = 'no Dept13 verdict';
  if (p.dept13) {
    verdict = p.dept13.current
      ? `Dept13 ${p.dept13.verdict} @${p.dept13.sha.slice(0, 8)} (current head)`
      : `Dept13 ${p.dept13.verdict} @${p.dept13.sha.slice(0, 8)} is STALE (head ${sha})`;
  }
  return `${prRef(p)}${p.draft ? ' (draft)' : ''} @${sha}: ${p.title} — ${verdict}`;
}

export function buildDigest(input: DigestInput): StatusDigest {
  const openPrs = (input.prs ?? []).filter((p) => p.state === 'open');
  const merged = (input.prs ?? []).filter((p) => p.state === 'merged');
  const ready = openPrs.filter((p) => p.dept13?.current && p.dept13.verdict === 'PASS');
  const needs13 = openPrs.filter((p) => !p.draft && !(p.dept13?.current ?? false));
  const failing = openPrs.filter((p) => p.dept13?.current && p.dept13.verdict !== 'PASS');

  const keys: DivisionKey[] = [...DIVISIONS, UNASSIGNED];
  const divisions: DivisionSummary[] = keys.map((division) => {
    const tasks = (input.tasks ?? []).filter((t) => t.division === division);
    return {
      division,
      openPrs: openPrs.filter((p) => p.division === division).length,
      needsDept13: needs13.filter((p) => p.division === division).length,
      readyForLogan: ready.filter((p) => p.division === division).length,
      failedAtHead: failing.filter((p) => p.division === division).length,
      mergedLast24h: merged.filter((p) => p.division === division).length,
      openTasks: tasks.filter((t) => t.status !== 'reassess').reduce((a, t) => a + t.n, 0),
      reassessTasks: tasks.filter((t) => t.status === 'reassess').reduce((a, t) => a + t.n, 0),
      pendingApprovals: (input.approvals ?? []).filter((a) => a.division === division).length,
      statsPostedLastWeek:
        division === UNASSIGNED || !input.stats
          ? null
          : (input.stats[division as DivisionId] ?? 0) > 0,
    };
  });

  const needsLogan = [
    ...ready.map((p) => `Merge yes? ${prLine(p)}`),
    ...(input.approvals ?? []).map(
      (a) => `Approval pending (${a.kind}, since ${berlinStamp(new Date(a.createdAt))}): ${a.title}`
    ),
  ];
  const needsDept13 = needs13.map(prLine);
  const machineAlerts: string[] = [];
  for (const t of input.systemd?.timers ?? []) {
    if (t.activeState !== 'active')
      machineAlerts.push(`timer ${t.id} is ${t.activeState}/${t.subState}`);
    if (t.serviceResult && t.serviceResult !== 'success')
      machineAlerts.push(
        `${t.unit} last result ${t.serviceResult} (exit ${t.serviceExitStatus ?? '?'})`
      );
  }
  for (const u of input.systemd?.failedUnits ?? []) machineAlerts.push(`failed unit ${u}`);
  machineAlerts.push(...checkoutSyncAlerts(input.checkoutSync));

  const L: string[] = [];
  L.push(`# DABOS status digest — ${berlinStamp(input.now)}`);
  L.push('');
  L.push(`Host ${input.host}. Stat week closed last: ${input.week.id} (${input.week.label}).`);
  L.push(
    'Pull-only full digest (ln02 file + Neon + /dabos/digest). Optional Telegram tip is ≤5 lines and separate — ruling-digest-delivery-2026-11-08.'
  );
  L.push(
    `Owner if this digest failed, is missing or is older than 2 h 30 min: ${OWNER_POST}.`
  );
  L.push('');
  L.push(`## Needs Logan (${needsLogan.length})`);
  L.push(...(needsLogan.length ? needsLogan.map((s) => `- ${s}`) : ['- nothing']));
  L.push('');
  L.push(`## Needs Dept13 at current head (${needsDept13.length})`);
  L.push(...(needsDept13.length ? needsDept13.map((s) => `- ${s}`) : ['- nothing']));
  if (failing.length) {
    L.push('');
    L.push(`## FAIL at current head (${failing.length})`);
    L.push(...failing.map((p) => `- ${prLine(p)}`));
  }
  L.push('');
  L.push('## Divisions');
  L.push(
    '| Div | open PRs | need Dept13 | ready for Logan | merged 24h | tasks open | reassess | approvals | stats ' +
      input.week.id +
      ' |'
  );
  L.push('|---|---|---|---|---|---|---|---|---|');
  for (const d of divisions) {
    if (
      d.division === UNASSIGNED &&
      !d.openPrs &&
      !d.mergedLast24h &&
      !d.openTasks &&
      !d.reassessTasks &&
      !d.pendingApprovals
    )
      continue;
    const stats =
      d.statsPostedLastWeek === null ? '—' : d.statsPostedLastWeek ? 'posted' : 'NOT posted';
    L.push(
      `| ${d.division} | ${d.openPrs} | ${d.needsDept13} | ${d.readyForLogan} | ${d.mergedLast24h} | ${d.openTasks} | ${d.reassessTasks} | ${d.pendingApprovals} | ${stats} |`
    );
  }
  L.push('');
  L.push(`## Merged in the last ${MERGED_WINDOW_HOURS} h (${merged.length})`);
  L.push(
    ...(merged.length
      ? merged.map((p) => `- ${prRef(p)} @${p.headSha.slice(0, 8)}: ${p.title}`)
      : ['- none'])
  );
  L.push('');
  L.push('## Cadences (latest role_runs)');
  if (input.cadence) {
    L.push(
      ...(input.cadence.length
        ? input.cadence.map((c) => `- ${c.roleId}: ${berlinStamp(new Date(c.ranAt))}`)
        : ['- none'])
    );
  } else L.push('- unavailable');
  L.push('');
  L.push(`## ${input.host} user timers`);
  if (input.systemd) {
    L.push(...(machineAlerts.length ? machineAlerts.map((s) => `- ALERT ${s}`) : ['- no alerts']));
    for (const t of input.systemd.timers) {
      L.push(
        `- ${t.id}: ${t.activeState}/${t.subState}, last ${t.lastTrigger}, next ${t.next}, service ${t.serviceResult ?? '?'}`
      );
    }
  } else L.push('- unavailable');
  L.push('');
  L.push(`## ${input.host} checkout sync (owner ${OWNER_POST})`);
  const cs = input.checkoutSync;
  if (cs) {
    L.push(
      cs.failFlag
        ? `- ALERT ${CHECKOUT_SYNC_FAIL_FILE} present${cs.failFlagText ? `: ${cs.failFlagText}` : ''}`
        : `- no ${CHECKOUT_SYNC_FAIL_FILE}`
    );
    if (cs.statusError) L.push(`- status: ${cs.statusError}`);
    else
      L.push(
        `- last run ${cs.lastRunState ?? '?'}${cs.endedAt ? ` at ${cs.endedAt}` : ''}`,
        ...cs.repos.map((r) => `- ${r.repo}: ${r.state}${r.message ? ` (${r.message})` : ''}`)
      );
  } else L.push('- unavailable');
  L.push('');
  const openSection = buildOpenOrdersSection(input.openOrders);
  if (openSection) L.push(openSection.trimEnd(), '');
  else {
    L.push('## Open orders');
    L.push('- unavailable');
    L.push('');
  }
  if (input.sourceErrors.length) {
    L.push('## Source errors');
    L.push(...input.sourceErrors.map((e) => `- ${e.source}: ${e.error}`));
    L.push('');
  }

  return {
    markdown: L.join('\n'),
    json: {
      version: 1,
      generatedAt: input.now.toISOString(),
      host: input.host,
      week: input.week.id,
      divisions,
      needsLogan,
      needsDept13,
      machineAlerts,
      checkoutSync: input.checkoutSync,
      openOrders: input.openOrders,
      ownerPost: OWNER_POST,
      sourceErrors: input.sourceErrors,
    },
  };
}

/** Collect every source; a failing source becomes a sourceErrors entry, never a crash. */
export async function collectDigestInput(deps: {
  now: Date;
  host: string;
  sql: DabosSql | null;
  github: { fetchFn: FetchLike; token: string } | null;
  run: RunCommand | null;
  unitFilter?: RegExp;
  repos?: readonly string[];
  checkoutSync?: { dir: string; readText: ReadText } | null;
}): Promise<DigestInput> {
  const sourceErrors: DigestInput['sourceErrors'] = [];
  const week = closedOrgWeek(deps.now);
  const safe = async <T>(source: string, fn: () => Promise<T>): Promise<T | null> => {
    try {
      return await fn();
    } catch (e) {
      sourceErrors.push({ source, error: errorText(e) });
      return null;
    }
  };

  let prs: PrSummary[] | null = null;
  if (deps.github) {
    const gh = deps.github;
    prs = [];
    for (const repo of deps.repos ?? DIGEST_REPOS) {
      const r = await safe(`github ${repo}`, () => fetchRepoPulls({ ...gh, repo, now: deps.now }));
      if (r) prs.push(...r);
    }
  } else sourceErrors.push({ source: 'github', error: 'DABOS_DIGEST_GITHUB_TOKEN not set' });

  let tasks = null;
  let approvals = null;
  let stats = null;
  let cadence = null;
  let openOrders: OpenOrderLine[] | null = null;
  if (deps.sql) {
    const sql = deps.sql;
    tasks = await safe('neon tasks', () => readTaskCounts(sql));
    approvals = await safe('neon approval_queue', () => readPendingApprovals(sql));
    stats = await safe('neon stats', () => readStatsPosted(sql, week));
    cadence = await safe('neon role_runs', () => readLatestCadenceRuns(sql));
    // Display only. Stall INSERTs run under dabos_build_receipt via `dabos:route-stalls`.
    openOrders = await safe('neon open-orders', () => readOpenOrders(sql, deps.now));
  } else sourceErrors.push({ source: 'neon', error: 'DABOS_DIGEST_DATABASE_URL not set' });

  const systemd = deps.run
    ? await safe('systemd --user', () => readSystemdUserState(deps.run!, deps.unitFilter))
    : null;
  if (!deps.run)
    sourceErrors.push({ source: 'systemd', error: 'disabled (DABOS_DIGEST_SYSTEMD=off)' });

  const cs = deps.checkoutSync;
  const checkoutSync = cs
    ? await safe('checkout-sync', () => readCheckoutSyncState(cs.dir, cs.readText))
    : null;
  if (!cs) sourceErrors.push({ source: 'checkout-sync', error: 'not configured' });

  return {
    now: deps.now,
    host: deps.host,
    week,
    prs,
    tasks,
    approvals,
    stats,
    cadence,
    systemd,
    checkoutSync,
    openOrders,
    sourceErrors,
  };
}

/** Error text without connection strings or tokens. */
export function errorText(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  return raw
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '<connection string>')
    .replace(/\b(gh[pousr]_|github_pat_)[A-Za-z0-9_]+/g, '<token>')
    .slice(0, 300);
}

/** Default human pull URL for Telegram tips (override via DABOS_DIGEST_PULL_URL). */
/** Clean path on dabos subdomain (proxy rewrites /digest → /dabos/digest). */
export const DEFAULT_DIGEST_PULL_URL = 'https://dabos.logans.tools/digest';

/**
 * Founder ruling 2026-11-08: Telegram tip ≤5 lines —
 * one counts line + up to three “needs you” lines + pull link.
 * Never includes full digest markdown, Neon task titles, or secrets.
 */
export function buildTelegramTip(
  digest: StatusDigest,
  opts?: { pullUrl?: string; maxNeedsLines?: number }
): string {
  const pull = (opts?.pullUrl ?? DEFAULT_DIGEST_PULL_URL).trim() || DEFAULT_DIGEST_PULL_URL;
  const maxNeeds = opts?.maxNeedsLines ?? 3;
  const nLogan = digest.json.needsLogan.length;
  const n13 = digest.json.needsDept13.length;
  const nAlert = digest.json.machineAlerts.length;
  const stamp = berlinStamp(new Date(digest.json.generatedAt));
  const lines: string[] = [
    `DABOS digest ${stamp} · you:${nLogan} · Dept13:${n13} · alerts:${nAlert}`,
  ];
  if (nLogan === 0) {
    lines.push('Nothing needs you.');
  } else {
    for (const item of digest.json.needsLogan.slice(0, maxNeeds)) {
      const one = item.replace(/\s+/g, ' ').trim().slice(0, 120);
      if (one) lines.push(`• ${one}`);
    }
  }
  lines.push(`Pull: ${pull}`);
  return lines.slice(0, 5).join('\n');
}

export type TelegramTipSendResult =
  | { sent: false; reason: 'disabled' | 'missing_env' | 'empty' }
  | { sent: true; messageId?: number }
  | { sent: false; reason: 'http'; status: number; detail: string };

/**
 * Opt-in Telegram Bot API send. Secrets from env only (never logged).
 * DABOS_DIGEST_TELEGRAM_TIP=1 + BOT_TOKEN + CHAT_ID required.
 */
export async function sendTelegramTip(deps: {
  text: string;
  botToken: string | null | undefined;
  chatId: string | null | undefined;
  enabled: boolean;
  fetchFn?: FetchLike;
}): Promise<TelegramTipSendResult> {
  if (!deps.enabled) return { sent: false, reason: 'disabled' };
  const token = deps.botToken?.trim();
  const chatId = deps.chatId?.trim();
  if (!token || !chatId) return { sent: false, reason: 'missing_env' };
  const text = deps.text.trim();
  if (!text) return { sent: false, reason: 'empty' };
  const fetchFn = deps.fetchFn ?? (fetch as unknown as FetchLike);
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetchFn(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    const body = res.text ? await res.text().catch(() => '') : '';
    return {
      sent: false,
      reason: 'http',
      status: res.status,
      detail: body.split(token).join('<token>').slice(0, 200),
    };
  }
  let messageId: number | undefined;
  try {
    const data = (await res.json()) as { result?: { message_id?: number } };
    messageId = data.result?.message_id;
  } catch {
    /* ignore parse */
  }
  return { sent: true, messageId };
}

/** Newest status_digest row for the pull UI. */
export async function readLatestStatusDigest(sql: DabosSql): Promise<{
  ranAt: string;
  markdown: string;
  needsLogan: string[];
  needsDept13: string[];
  machineAlerts: string[];
  host: string | null;
} | null> {
  const rows = (await sql`
    SELECT ran_at, summary_json
    FROM role_runs
    WHERE role_id = ${DIGEST_ROLE_ID}
    ORDER BY ran_at DESC
    LIMIT 1
  `) as Array<{ ran_at: Date | string; summary_json: Record<string, unknown> | null }>;
  if (!rows.length) return null;
  const j = rows[0].summary_json ?? {};
  const markdown = typeof j.markdown === 'string' ? j.markdown : '';
  const needsLogan = Array.isArray(j.needsLogan) ? j.needsLogan.map(String) : [];
  const needsDept13 = Array.isArray(j.needsDept13) ? j.needsDept13.map(String) : [];
  const machineAlerts = Array.isArray(j.machineAlerts) ? j.machineAlerts.map(String) : [];
  const host = typeof j.host === 'string' ? j.host : null;
  return {
    ranAt: toIso(rows[0].ran_at),
    markdown,
    needsLogan,
    needsDept13,
    machineAlerts,
    host,
  };
}
