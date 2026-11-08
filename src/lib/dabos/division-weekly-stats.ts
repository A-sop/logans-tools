/**
 * Division + department weekly/monthly stats → Neon (Dept03 / P03-1).
 * GDS keys: gds-metric-map.ts · counting rules: DABOS dept03-perception/stat-counting-rules.md
 * Optional week logs under dabos-registers; missing log → skip (to-report), present → 0 OK.
 * Cron skips local-path metrics when files/DB are absent (no fake zeros from empty sandbox).
 */
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import {
  computeArtifactsIndexedWeekly,
  DEFAULT_WIKI_GIT_REF,
  FINGERPRINT_RE,
  type GitRunner,
  type PreviousDiv1Row,
} from '@/lib/dabos/artifacts-indexed';
import type { DabosSql } from '@/lib/dabos/dabos-connection';
import {
  closedOrgWeek,
  closedOrgWeekForIsoWeek,
  isEntryInClosedOrgWeek,
  recordedAtForClosedOrgWeek,
  REGISTER_DATE_TIME_SOURCE,
  type ClosedOrgWeek,
} from '@/lib/dabos/org-week-window';
import {
  countCommsUnits,
  countEnrollments,
  countProductSalesQty,
  countVerdictsDecided,
  readOptionalText,
  sumEurLog,
} from '@/lib/dabos/stat-log-counters';

export type DivisionWeeklyResult = {
  workspaceId: string;
  recordedAt: string;
  window: { start: string; end: string; label: string };
  inserted: string[];
  notes: string[];
};

// Office defaults are Windows paths (C:\DATA, C:\Dev\DABOS). Override on a non-office
// host (e.g. ln02 reading a Seagate mirror): DABOS_REGISTERS_ROOT, DABOS_REPO_ROOT.
const REGISTERS =
  process.env.DABOS_REGISTERS_ROOT?.trim() || path.join('C:', 'DATA', '10_WORK', 'dabos-registers');
const DABOS_REPO_ROOT = process.env.DABOS_REPO_ROOT?.trim() || path.join('C:', 'Dev', 'DABOS');

/**
 * Div1 wiki source root: DABOS_WIKI_REPO_ROOT (e.g. ln02's dedicated clone fetched after the close),
 * else DABOS_REPO_ROOT, else the office default. Only Div1 reads it; ship-log/validation/establishment
 * stay on DABOS_REPO_ROOT (RR-010 step 0).
 */
export function resolveDiv1WikiRepoRoot(
  env: Record<string, string | undefined> = process.env
): string {
  return env.DABOS_WIKI_REPO_ROOT?.trim() || env.DABOS_REPO_ROOT?.trim() || path.join('C:', 'Dev', 'DABOS');
}
const SHIP_LOG = path.join(DABOS_REPO_ROOT, 'docs', 'registers', 'ship-log.md');
const VALIDATION = path.join(DABOS_REPO_ROOT, 'docs', 'registers', 'dept13-validation-checklists.md');
const ESTABLISHMENT = path.join(
  DABOS_REPO_ROOT,
  'docs',
  'reference',
  'dept-briefs',
  'establishment-checklist.md'
);
const DEFAULT_PROVISO_DB = path.join('C:', 'Dev', 'proviso', 'data', 'proviso.db');
const LW_VB = 2106750;

function readText(filePath: string): string | null {
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath, 'utf8');
}

/** Content factory = Div2. Count pieces submitted for validation. */
export function countContentPiecesShipped(contentStatusMd: string | null): number {
  if (!contentStatusMd) return 0;
  const rows = contentStatusMd
    .split('\n')
    .filter((line) => /^\| [^|]+\|/.test(line) && !line.includes('piece_id') && !line.includes('---'));
  let n = 0;
  for (const row of rows) {
    if (/\*\(none|\*\(empty|honest empty/i.test(row)) continue;
    const cells = row.split('|').map((c) => c.trim());
    // | piece_id | venture | type | produced | submitted_validation | ...
    const submitted = cells[5] ?? '';
    if (!submitted || submitted === '—' || submitted === '-' || submitted.startsWith('*(')) continue;
    if (/^\d{4}-\d{2}-\d{2}/.test(submitted) || submitted.toLowerCase() === 'yes') n += 1;
  }
  return n;
}

/** Pipeline open prospects with a real identity (not skeleton blanks). */
export function countPipelineTouchpoints(pipelineMd: string | null): number {
  if (!pipelineMd) return 0;
  const rows = pipelineMd
    .split('\n')
    .filter((line) => /^\|\s*\d+\s*\|/.test(line));
  let n = 0;
  for (const row of rows) {
    const cells = row.split('|').map((c) => c.trim());
    const prospect = cells[2] ?? '';
    if (!prospect) continue;
    n += 1;
  }
  return n;
}

type WeekWindow = Pick<ClosedOrgWeek, 'start' | 'end' | 'startDate' | 'endDate'>;

/**
 * A 'pending' qualifier placed IMMEDIATELY after a PASS token, e.g. 'PASS** (pending formal',
 * 'PASS (pending', 'PASS - pending'. A later mention of 'pending' in the reason text does not
 * qualify the verdict (Instance 1 in the real register is a FAIL whose reason says "pending").
 */
const PENDING_QUALIFIER_RE = /^\s*\**\s*(?:[([]\s*|[\u2014\u2013:,;-]\s*)?pending\b/i;

/** Token boundary: 'PASS-conditional', 'PASS/FAIL', 'PASSED' are not a bare PASS / FAIL. */
const BARE_TOKEN_END = '(?![\\w/-])';

/** Ship-log cell: uppercase PASS only (outside a 'Verdict:' line, case matters). */
const PASS_CELL_RE = new RegExp('^PASS' + BARE_TOKEN_END + '(.*)$');
const LEADING_DATE_RE = new RegExp('^\\s*(' + REGISTER_DATE_TIME_SOURCE + ')(.*)$');

/**
 * PASS date from a ship-log 'Validated (Dept13)' cell, e.g. '**PASS 2026-07-11** (instance 3)'.
 * Returns null for FAIL, CONDITIONAL, 'PASS-conditional', lowercase 'pass', 'pending PASS',
 * a PASS qualified as pending right after the token or its date, or a PASS without a date.
 */
export function shipLogPassDate(validatedCell: string): string | null {
  const cell = validatedCell.trim().replace(/^\*+/, '');
  const m = PASS_CELL_RE.exec(cell);
  if (!m) return null;
  const afterPass = m[1] ?? '';
  if (PENDING_QUALIFIER_RE.test(afterPass)) return null;
  const d = LEADING_DATE_RE.exec(afterPass.replace(/^\*+/, ''));
  if (!d?.[1]) return null;
  if (PENDING_QUALIFIER_RE.test(d[2] ?? '')) return null;
  return d[1];
}
/**
 * shipped_outputs: ship-log rows where 'Validated (Dept13)' is PASS <date> (not pending, FAIL,
 * CONDITIONAL) AND Counts = yes. Columns:
 * | # | Date | What shipped | Acceptance line | Venture | Validated (Dept13) | Counts |
 * With window (weekly poster path) the row is bucketed by its Dept13 PASS date, not the ship
 * Date column (see isEntryInClosedOrgWeek: timestamps exact 14:00 cutoff; date-only provisional
 * Thu..Wed pending Dept14). Without window: all-time (ship-gate), same PASS requirement.
 */
export function countShippedOutputs(shipLogMd: string | null, window?: WeekWindow): number {
  if (!shipLogMd) return 0;
  const tableStart = shipLogMd.indexOf('| # | Date |');
  if (tableStart < 0) return 0;
  const section = shipLogMd.slice(tableStart);
  const rows = section.split('\n').filter((line) => /^\|\s*\d+\s*\|/.test(line));
  return rows.filter((row) => {
    const cells = row.split('|').map((c) => c.trim());
    const counts = (cells[cells.length - 2] ?? '').toLowerCase().replace(/\*/g, '');
    if (!(counts === 'yes' || counts.startsWith('yes'))) return false;
    const passDate = shipLogPassDate(cells[cells.length - 3] ?? '');
    if (!passDate) return false;
    return window ? isEntryInClosedOrgWeek(passDate, window) : true;
  }).length;
}

/** First 'Verdict:' line of an instance (bold, bold-label or plain; list / quote prefixes ok). */
const VERDICT_LINE_RE = /^[\s>*-]*\**\s*Verdict\s*:(.*)$/im;
/** Inside a Verdict: line the token may be any case; it must be a bare PASS / FAIL. */
const VERDICT_TOKEN_RE = new RegExp('^\\s*(?:\\*+\\s*)*(PASS|FAIL)' + BARE_TOKEN_END + '(.*)$', 'i');
const VALIDATED_ON_RE = new RegExp(
  '\\**\\s*Validated on\\s*:\\s*\\**\\s*(' + REGISTER_DATE_TIME_SOURCE + ')',
  'i'
);

/**
 * Decided verdict of one Dept13 checklist instance, read from its FIRST 'Verdict:' line:
 * PASS / FAIL, or null when absent, empty template, CONDITIONAL, a qualified token
 * ('PASS-conditional'), or a PASS qualified as pending immediately after the token
 * ('**Verdict: PASS** (pending formal Dept13 ...)'). 'pending' later in a reason never drops a
 * verdict, and FAIL is never dropped for 'pending'.
 * Accepts '**Verdict: PASS**', '**Verdict:** FAIL', unbolded 'Verdict: FAIL', 'Verdict: fail'.
 */
export function instanceVerdict(block: string): 'PASS' | 'FAIL' | null {
  const line = VERDICT_LINE_RE.exec(block);
  if (!line) return null;
  const m = VERDICT_TOKEN_RE.exec(line[1] ?? '');
  if (!m?.[1]) return null;
  const verdict = m[1].toUpperCase() as 'PASS' | 'FAIL';
  if (verdict === 'PASS' && PENDING_QUALIFIER_RE.test(m[2] ?? '')) return null;
  return verdict;
}
/**
 * qa_pass_rate = PASS / (PASS + FAIL), counted PER VERDICT INSTANCE ('## Instance N' block in
 * the Dept13 checklist register) - not per PR and not per SHA: two instances for the same PR
 * (e.g. FAIL then PASS on a re-review) are two verdicts.
 * Weekly poster path: pass { window } and only instances whose 'Validated on:' value is inside
 * the closed org week count (isEntryInClosedOrgWeek). Legacy { year, week } = the stat week
 * labelled year-Www (closing Thursday 14:00 Berlin, org-week.ts), same rule. Without opts: all-time. 0 verdicts in scope -> null (to-report).
 */
export function computeQaPassRate(
  validationMd: string | null,
  opts?: { year: number; week: number } | { window: WeekWindow }
): number | null {
  if (!validationMd) return null;

  const instanceBlocks = validationMd.split(/^## Instance\s+\d+/im).slice(1);
  const blocks = instanceBlocks.length > 0 ? instanceBlocks : [validationMd];

  const verdicts: string[] = [];
  for (const block of blocks) {
    const verdict = instanceVerdict(block);
    if (!verdict) continue;

    if (opts) {
      const dateMatch = VALIDATED_ON_RE.exec(block);
      if (!dateMatch?.[1]) continue;
      const scope = 'window' in opts ? opts.window : closedOrgWeekForIsoWeek(opts.year, opts.week);
      if (!isEntryInClosedOrgWeek(dateMatch[1], scope)) continue;
    }

    verdicts.push(verdict);
  }

  if (verdicts.length === 0) return null;
  const pass = verdicts.filter((v) => v === 'PASS').length;
  return Math.round((pass / verdicts.length) * 1000) / 10;
}

/** plan_completion_rate = depts with Stat status reported / 21. */
export function computePlanCompletionRate(checklistMd: string | null): number | null {
  if (!checklistMd) return null;
  const rows = checklistMd.split('\n').filter((line) => /^\|\s*\d+\s*\|/.test(line));
  if (rows.length === 0) return null;
  const reported = rows.filter((row) => /\*\*reported/i.test(row) || /\|[^|]*reported:/i.test(row))
    .length;
  return Math.round((reported / 21) * 1000) / 10;
}

export type ProvisoMonthIncome = {
  monat: string; // MM.YYYY
  eur: number;
  lineCount: number;
};

/** Minimal shape of node:sqlite DatabaseSync used below (params _-prefixed for no-unused-vars). */
type NodeSqliteDatabaseCtor = new (
  _dbPath: string,
  _options?: { readOnly?: boolean }
) => {
  prepare: (_sql: string) => { all: (..._params: unknown[]) => unknown[] };
  close: () => void;
};

/** Sum Diskont-Konto (Abrechnung residual EUR) for Logan VB — local Proviso only. */
export function readProvisoMonthlyIncome(
  dbPath = process.env.PROVISO_DB_PATH?.trim() || DEFAULT_PROVISO_DB,
  vb = LW_VB
): ProvisoMonthIncome[] {
  if (!existsSync(dbPath)) return [];
  // Node 22+ built-in SQLite — no native addon; scripts/office only.
  // Avoid `import('node:sqlite')` types — Vercel/tsc may not have @types for it.
  const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: NodeSqliteDatabaseCtor };
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const rows = db
      .prepare(
        `
      SELECT monat,
             COUNT(*) AS line_count,
             ROUND(SUM(COALESCE(NULLIF(diskont_konto, 0), einheiten * COALESCE(provisionssatz, 0) / 10.0)), 2) AS eur
      FROM commission_events
      WHERE abschlussvermittler = ?
      GROUP BY monat
      ORDER BY substr(monat, 4) || substr(monat, 1, 2) DESC
    `
      )
      .all(vb) as Array<{ monat: string; line_count: number; eur: number }>;
    return rows.map((r) => ({
      monat: String(r.monat),
      eur: Number(r.eur) || 0,
      lineCount: Number(r.line_count) || 0,
    }));
  } finally {
    db.close();
  }
}

async function insertStat(
  dabosSql: DabosSql,
  row: {
    workspaceId: string;
    divisionId: string;
    departmentId: string | null;
    metricKey: string;
    value: number;
    recordedAt: string;
    basis?: Record<string, unknown> | null;
    recordedBy?: string | null;
  }
): Promise<boolean> {
  const basis = row.basis ? JSON.stringify(row.basis) : null;
  const recordedBy = row.recordedBy ?? null;
  const res = await dabosSql`
    insert into stats (workspace_id, division_id, department_id, metric_key, value, recorded_at, basis, recorded_by)
    select ${row.workspaceId}, ${row.divisionId}, ${row.departmentId}, ${row.metricKey}, ${row.value}, ${row.recordedAt}::timestamptz, ${basis}::jsonb, ${recordedBy}
    where not exists (
      select 1 from stats s
      where s.workspace_id = ${row.workspaceId}
        and s.division_id = ${row.divisionId}
        and s.department_id is not distinct from ${row.departmentId}
        and s.metric_key = ${row.metricKey}
    )
    returning metric_key
  `;
  return Boolean(res[0]?.metric_key);
}

/**
 * The previous stat week's ACTIVE live Div1 row (superseded_at is null; any recorded_by, e.g. the
 * week-close poster or a backfill such as #49): its basis.page_fingerprints are this week's start
 * point. Null when no such row exists. When the row lacks page_fingerprints (legacy pre-fingerprint
 * poster), returns missingFingerprints so compute can reconstruct from wiki git history. Throws
 * when fingerprints are present but malformed (a wrong format would silently count every page as
 * added) — never reconstructs in that case.
 */
export async function loadPreviousDiv1Fingerprints(
  dabosSql: DabosSql,
  window: Pick<ClosedOrgWeek, 'start'>
): Promise<PreviousDiv1Row | null> {
  const prev = closedOrgWeek(window.start);
  const prevWorkspace = `div-live-${prev.isoYear}-W${String(prev.isoWeek).padStart(2, '0')}`;
  const res = (await dabosSql`
    select basis from stats
    where workspace_id = ${prevWorkspace}
      and division_id = 'Div1'
      and department_id is null
      and metric_key = 'artifacts_indexed'
      and superseded_at is null
    order by recorded_at desc
    limit 1
  `) as Array<{ basis: unknown }>;
  const raw = res[0]?.basis;
  if (res.length === 0) return null;
  const basis = (typeof raw === 'string' ? JSON.parse(raw) : raw) as {
    page_fingerprints?: unknown;
    git_end_commit?: unknown;
  } | null;
  const end = basis?.git_end_commit;
  const gitEndCommit = typeof end === 'string' && /^[0-9a-f]{40}$/.test(end) ? end : null;
  const hasFpsKey = basis != null && typeof basis === 'object' && 'page_fingerprints' in basis;
  const fps = hasFpsKey ? basis.page_fingerprints : undefined;
  // Absent / null / undefined = legacy row (W43 poster, W31–W43 backfill). Reconstruct later.
  // Never treat as an empty fingerprint set.
  if (!hasFpsKey || fps === null || fps === undefined) {
    return { week: prev.id, fingerprints: [], gitEndCommit, missingFingerprints: true };
  }
  if (!Array.isArray(fps) || !fps.every((f) => typeof f === 'string' && FINGERPRINT_RE.test(f))) {
    throw new Error(`${prevWorkspace} Div1 row has no valid basis.page_fingerprints (16 lowercase hex strings)`);
  }
  return {
    week: prev.id,
    fingerprints: fps as string[],
    gitEndCommit,
  };
}

export async function postDivisionWeeklyStats(opts: {
  dabosSql: DabosSql;
  /** Closed org week to post (preferred). Week-close passes closedOrgWeek(now). */
  window?: ClosedOrgWeek;
  /** Legacy: ISO week of the closing Thursday; resolved to that closed org week. */
  year?: number;
  week?: number;
  includeProvisoMonths?: number;
  /** Post only these divisions (e.g. ['Div1'] for a one-off backfill). Default: all. */
  only?: string[];
  /** Test hooks: Div1 DABOS checkout root (default resolveDiv1WikiRepoRoot()) and git runner. */
  dabosRepoRoot?: string;
  git?: GitRunner;
  /** Div1 wiki source (default env DABOS_WIKI_SOURCE, else 'auto'); see artifacts-indexed.ts. */
  wikiSource?: 'auto' | 'snapshot';
}): Promise<DivisionWeeklyResult> {
  const { dabosSql } = opts;
  let window = opts.window;
  if (!window) {
    if (opts.year == null || opts.week == null) {
      throw new Error('postDivisionWeeklyStats: pass window, or year + week');
    }
    window = closedOrgWeekForIsoWeek(opts.year, opts.week);
  }
  const workspaceId = `div-live-${window.isoYear}-W${String(window.isoWeek).padStart(2, '0')}`;
  const recordedAt = recordedAtForClosedOrgWeek(window);
  const windowBasis = {
    org_week_start: window.start.toISOString(),
    org_week_end: window.end.toISOString(),
    window_rule:
      'Thu 14:00 -> Thu 14:00 Europe/Berlin; timestamped entries exact cutoff; date-only entries Thu..Wed (provisional, pending Dept14); shipped_outputs by Dept13 PASS date; qa per verdict instance',
  };
  const notes: string[] = [];
  const inserted: string[] = [];

  const contentStatusPath = path.join(REGISTERS, 'content-status-table.md');
  const pipelinePath = path.join(REGISTERS, 'pipeline-register.md');
  const commsLogPath = path.join(REGISTERS, 'comms-handled-log.md');
  const enrollmentsLogPath = path.join(REGISTERS, 'enrollments-log.md');
  const productSalesLogPath = path.join(REGISTERS, 'product-sales-log.md');
  const billsPaidLogPath = path.join(REGISTERS, 'bills-paid-log.md');
  const fsmCommissionsLogPath = path.join(REGISTERS, 'fsm-commissions-log.md');
  const qualCashLogPath = path.join(REGISTERS, 'qual-cash-log.md');
  const despatchesLogPath = path.join(REGISTERS, 'despatches-cleared-log.md');
  const designsLogPath = path.join(REGISTERS, 'designs-accepted-log.md');
  const buildCompletionsLogPath = path.join(REGISTERS, 'build-completions-log.md');
  const certsLogPath = path.join(REGISTERS, 'certs-issued-log.md');
  const successStoriesLogPath = path.join(REGISTERS, 'success-stories-log.md');
  const openDebtsLogPath = path.join(REGISTERS, 'open-debts-log.md');
  const reservesLogPath = path.join(REGISTERS, 'reserves-log.md');
  const conditionsLogPath = path.join(REGISTERS, 'conditions-from-stats-log.md');
  const prioritiesLogPath = path.join(REGISTERS, 'priorities-locked-log.md');
  const approvalsLogPath = path.join(REGISTERS, 'approvals-cleared-log.md');

  const contentStatus = readText(contentStatusPath);
  const pipeline = readText(pipelinePath);
  const shipLog = readText(SHIP_LOG);
  const validation = readText(VALIDATION);
  const checklist = readText(ESTABLISHMENT);

  const contentPieces = countContentPiecesShipped(contentStatus);
  const touchpoints = countPipelineTouchpoints(pipeline);
  const shipped = countShippedOutputs(shipLog, window);
  const qaRate = computeQaPassRate(validation, { window });
  const planRate = computePlanCompletionRate(checklist);
  const verdictsDecided = countVerdictsDecided(
    validation,
    window,
    instanceVerdict,
    VALIDATED_ON_RE
  );

  const commsOut = countCommsUnits(readOptionalText(commsLogPath), window, 'out');
  const commsIn = countCommsUnits(readOptionalText(commsLogPath), window, 'in');
  const enrollments = countEnrollments(readOptionalText(enrollmentsLogPath), window);
  const productSales = countProductSalesQty(readOptionalText(productSalesLogPath), window);
  const billsPaid = sumEurLog(readOptionalText(billsPaidLogPath), window, 2);
  const fsmCommissions = sumEurLog(readOptionalText(fsmCommissionsLogPath), window, 3);
  const qualCash = sumEurLog(readOptionalText(qualCashLogPath), window, 2);
  const despatches = countEnrollments(readOptionalText(despatchesLogPath), window);
  const designs = countEnrollments(readOptionalText(designsLogPath), window);
  const buildCompletions = countEnrollments(readOptionalText(buildCompletionsLogPath), window);
  const certsIssued = countEnrollments(readOptionalText(certsLogPath), window);
  const successStories = countEnrollments(readOptionalText(successStoriesLogPath), window);
  const openDebts = sumEurLog(readOptionalText(openDebtsLogPath), window, 2);
  const reserves = sumEurLog(readOptionalText(reservesLogPath), window, 1);
  const conditionsFromStats = countEnrollments(readOptionalText(conditionsLogPath), window);
  const prioritiesLocked = countEnrollments(readOptionalText(prioritiesLogPath), window);
  const approvalsCleared = countEnrollments(readOptionalText(approvalsLogPath), window);

  type StatRow = {
    divisionId: string;
    departmentId: string | null;
    metricKey: string;
    value: number;
    source: string;
    basis?: Record<string, unknown>;
  };
  const rows: StatRow[] = [];
  const push = (row: StatRow) => rows.push(row);
  const pushOrNote = (
    value: number | null,
    row: Omit<StatRow, 'value'>,
    missingNote: string
  ) => {
    if (value == null) {
      notes.push(missingNote);
      return;
    }
    push({ ...row, value });
    notes.push(`${row.divisionId}${row.departmentId ? '.' + row.departmentId : ''}.${row.metricKey}=${value}`);
  };

  // --- Div1 GDS + substat ---
  pushOrNote(commsOut, {
    divisionId: 'Div1',
    departmentId: null,
    metricKey: 'comms_out',
    source: 'comms-handled-log.md Units where Direction=out',
  }, `Div1.comms_out skipped — missing ${commsLogPath}`);
  pushOrNote(commsIn, {
    divisionId: 'Div1',
    departmentId: null,
    metricKey: 'comms_in',
    source: 'comms-handled-log.md Units where Direction=in',
  }, `Div1.comms_in skipped — missing ${commsLogPath}`);
  pushOrNote(commsIn, {
    divisionId: 'Div1',
    departmentId: 'Dept1',
    metricKey: 'comms_in',
    source: 'comms-handled-log.md (Dept1 headline)',
  }, `Dept1.comms_in skipped — missing ${commsLogPath}`);
  pushOrNote(despatches, {
    divisionId: 'Div1',
    departmentId: 'Dept2',
    metricKey: 'despatches_cleared',
    source: 'despatches-cleared-log.md',
  }, `Dept2.despatches_cleared skipped — missing ${despatchesLogPath}`);

  const div1 = await computeArtifactsIndexedWeekly({
    window,
    repoRoot: opts.dabosRepoRoot ?? resolveDiv1WikiRepoRoot(),
    gitRef: process.env.DABOS_WIKI_GIT_REF?.trim() || DEFAULT_WIKI_GIT_REF,
    source: opts.wikiSource ?? (process.env.DABOS_WIKI_SOURCE?.trim() === 'snapshot' ? 'snapshot' : 'auto'),
    git: opts.git,
    loadPreviousFingerprints: () => loadPreviousDiv1Fingerprints(dabosSql, window),
  });
  if (div1.ok) {
    push({
      divisionId: 'Div1',
      departmentId: null,
      metricKey: 'artifacts_indexed',
      value: div1.value,
      source: `DABOS docs/wiki/index.md: unique pages added (${div1.basis.method})`,
      basis: div1.basis,
    });
    push({
      divisionId: 'Div1',
      departmentId: 'Dept1',
      metricKey: 'artifacts_indexed',
      value: div1.value,
      source: 'Dept1 substat mirror of wiki pages added',
      basis: div1.basis,
    });
    notes.push(
      `Div1 artifacts_indexed=${div1.value} (${div1.basis.pages_at_start} -> ${div1.basis.pages_at_end})`
    );
  } else {
    notes.push(`Div1 artifacts_indexed NOT POSTED - ${div1.reason}`);
  }

  // --- Div2 GDS + substats ---
  pushOrNote(enrollments, {
    divisionId: 'Div2',
    departmentId: null,
    metricKey: 'new_enrollments',
    source: 'enrollments-log.md (paid+started in window)',
  }, `Div2.new_enrollments skipped — missing ${enrollmentsLogPath}`);
  pushOrNote(enrollments, {
    divisionId: 'Div2',
    departmentId: 'Dept6',
    metricKey: 'new_enrollments',
    source: 'enrollments-log.md (Dept6 headline)',
  }, `Dept6.new_enrollments skipped — missing ${enrollmentsLogPath}`);
  pushOrNote(productSales, {
    divisionId: 'Div2',
    departmentId: null,
    metricKey: 'product_sales',
    source: 'product-sales-log.md sum Qty',
  }, `Div2.product_sales skipped — missing ${productSalesLogPath}`);

  if (contentStatus != null) {
    push({
      divisionId: 'Div2',
      departmentId: 'Dept4',
      metricKey: 'content_pieces_shipped',
      value: contentPieces,
      source: 'content-status-table.md (snapshot)',
    });
    push({
      divisionId: 'Div2',
      departmentId: 'Dept5',
      metricKey: 'fulfillments_shipped',
      value: contentPieces,
      source: 'content-status-table.md proxy until fulfillments log exists',
    });
    notes.push(`Dept4.content_pieces_shipped=${contentPieces}; Dept5.fulfillments_shipped mirror`);
  } else {
    notes.push(`Div2 content_pieces_shipped skipped — missing ${contentStatusPath}`);
  }

  if (pipeline != null) {
    push({
      divisionId: 'Div2',
      departmentId: null,
      metricKey: 'leads_or_touchpoints_created',
      value: touchpoints,
      source: 'pipeline-register.md (open prospects snapshot)',
    });
    notes.push(`Div2 leads_or_touchpoints_created=${touchpoints}`);
  } else {
    notes.push(`Div2 leads_or_touchpoints_created skipped — missing ${pipelinePath}`);
  }

  // --- Div3 weekly substats (GDS collections mainly on proviso-*; bills from log) ---
  pushOrNote(billsPaid, {
    divisionId: 'Div3',
    departmentId: null,
    metricKey: 'bills_paid_eur',
    source: 'bills-paid-log.md sum EUR',
  }, `Div3.bills_paid_eur skipped — missing ${billsPaidLogPath}`);
  pushOrNote(billsPaid, {
    divisionId: 'Div3',
    departmentId: 'Dept8',
    metricKey: 'bills_paid_eur',
    source: 'bills-paid-log.md (Dept8 headline)',
  }, `Dept8.bills_paid_eur skipped — missing ${billsPaidLogPath}`);
  pushOrNote(openDebts, {
    divisionId: 'Div3',
    departmentId: 'Dept7',
    metricKey: 'open_debts_eur',
    source: 'open-debts-log.md (substat; not bills paid)',
  }, `Dept7.open_debts_eur skipped — missing ${openDebtsLogPath}`);
  pushOrNote(reserves, {
    divisionId: 'Div3',
    departmentId: 'Dept9',
    metricKey: 'reserves_eur',
    source: 'reserves-log.md',
  }, `Dept9.reserves_eur skipped — missing ${reservesLogPath}`);

  // --- Div4 completions ---
  if (shipLog != null) {
    const shipSource = 'docs/registers/ship-log.md Counts=yes, PASS date in closed week';
    for (const key of ['shipped_outputs', 'completions'] as const) {
      push({ divisionId: 'Div4', departmentId: null, metricKey: key, value: shipped, source: shipSource });
      push({ divisionId: 'Div4', departmentId: 'Dept12', metricKey: key, value: shipped, source: shipSource });
    }
    notes.push(`Div4 completions=${shipped} (ship-log mirror)`);
  } else {
    notes.push(`Div4 completions skipped — missing ${SHIP_LOG}`);
  }
  pushOrNote(designs, {
    divisionId: 'Div4',
    departmentId: 'Dept10',
    metricKey: 'designs_accepted',
    source: 'designs-accepted-log.md',
  }, `Dept10.designs_accepted skipped — missing ${designsLogPath}`);
  pushOrNote(buildCompletions, {
    divisionId: 'Div4',
    departmentId: 'Dept11',
    metricKey: 'build_completions',
    source: 'build-completions-log.md',
  }, `Dept11.build_completions skipped — missing ${buildCompletionsLogPath}`);

  // --- Div5 Qual ---
  pushOrNote(qualCash, {
    divisionId: 'Div5',
    departmentId: null,
    metricKey: 'qual_cash_eur',
    source: 'qual-cash-log.md (0 OK until paid Qual product exists)',
  }, `Div5.qual_cash_eur skipped — missing ${qualCashLogPath}`);
  if (qaRate != null) {
    push({
      divisionId: 'Div5',
      departmentId: null,
      metricKey: 'qa_pass_rate',
      value: qaRate,
      source: 'dept13-validation-checklists.md',
    });
    notes.push(`Div5 qa_pass_rate=${qaRate}`);
  } else {
    notes.push('Div5 qa_pass_rate to-report: 0 Dept13 verdicts in window');
  }
  pushOrNote(verdictsDecided, {
    divisionId: 'Div5',
    departmentId: 'Dept13',
    metricKey: 'verdicts_decided',
    source: 'Dept13 instances with Verdict PASS/FAIL Validated on in window',
  }, 'Dept13.verdicts_decided skipped — validation register missing');
  // reviews_completed: FAIL verdicts in window (repair demand)
  if (validation != null && verdictsDecided != null) {
    const fails = countVerdictsDecided(
      validation,
      window,
      (b) => (instanceVerdict(b) === 'FAIL' ? 'FAIL' : null),
      VALIDATED_ON_RE
    );
    if (fails != null) {
      push({
        divisionId: 'Div5',
        departmentId: 'Dept14',
        metricKey: 'reviews_completed',
        value: fails,
        source: 'FAIL verdicts in window (proxy until Review log)',
      });
      notes.push(`Dept14.reviews_completed=${fails} (FAIL proxy)`);
    }
  }
  pushOrNote(certsIssued, {
    divisionId: 'Div5',
    departmentId: 'Dept15',
    metricKey: 'certs_issued',
    source: 'certs-issued-log.md',
  }, `Dept15.certs_issued skipped — missing ${certsLogPath}`);

  // --- Div6 FSM half on div-live; new_cf also from GFP poster ---
  pushOrNote(fsmCommissions, {
    divisionId: 'Div6',
    departmentId: null,
    metricKey: 'fsm_commissions_paid_eur',
    source: 'fsm-commissions-log.md',
  }, `Div6.fsm_commissions_paid_eur skipped — missing ${fsmCommissionsLogPath}`);
  pushOrNote(fsmCommissions, {
    divisionId: 'Div6',
    departmentId: 'Dept17',
    metricKey: 'fsm_commissions_paid_eur',
    source: 'fsm-commissions-log.md (Dept17 headline)',
  }, `Dept17.fsm_commissions_paid_eur skipped — missing ${fsmCommissionsLogPath}`);
  pushOrNote(successStories, {
    divisionId: 'Div6',
    departmentId: 'Dept18',
    metricKey: 'success_stories_published',
    source: 'success-stories-log.md',
  }, `Dept18.success_stories_published skipped — missing ${successStoriesLogPath}`);

  // --- Div7 substats; GI from Proviso below ---
  if (planRate != null) {
    push({
      divisionId: 'Div7',
      departmentId: null,
      metricKey: 'plan_completion_rate',
      value: planRate,
      source: 'establishment-checklist.md',
    });
    push({
      divisionId: 'Div7',
      departmentId: 'Dept21',
      metricKey: 'plan_completion_rate',
      value: planRate,
      source: 'establishment-checklist.md substat',
    });
    notes.push(`Div7 plan_completion_rate=${planRate}`);
  } else {
    notes.push('Div7 plan_completion_rate skipped — establishment checklist unreadable');
  }
  pushOrNote(conditionsFromStats, {
    divisionId: 'Div7',
    departmentId: 'Dept19',
    metricKey: 'conditions_from_stats',
    source: 'conditions-from-stats-log.md',
  }, `Dept19.conditions_from_stats skipped — missing ${conditionsLogPath}`);
  pushOrNote(prioritiesLocked, {
    divisionId: 'Div7',
    departmentId: 'Dept20',
    metricKey: 'priorities_locked',
    source: 'priorities-locked-log.md',
  }, `Dept20.priorities_locked skipped — missing ${prioritiesLogPath}`);
  pushOrNote(approvalsCleared, {
    divisionId: 'Div7',
    departmentId: 'Dept21',
    metricKey: 'approvals_cleared',
    source: 'approvals-cleared-log.md',
  }, `Dept21.approvals_cleared skipped — missing ${approvalsLogPath}`);

  // Dept3 headline: how many division GDS primaries we are about to insert this run
  const gdsKeysPosted = rows.filter(
    (r) =>
      r.departmentId == null &&
      [
        'comms_out',
        'new_enrollments',
        'collections_eur',
        'completions',
        'qual_cash_eur',
        'fsm_commissions_paid_eur',
        'gross_income_eur',
      ].includes(r.metricKey)
  ).length;
  push({
    divisionId: 'Div1',
    departmentId: 'Dept3',
    metricKey: 'stats_posted_on_time',
    value: gdsKeysPosted,
    source: 'count of GDS primary rows in this poster batch (Div-level)',
  });
  notes.push(`Dept3.stats_posted_on_time=${gdsKeysPosted} (GDS primaries in this batch)`);

  const only = opts.only ? new Set(opts.only) : null;
  for (const row of rows) {
    if (only && !only.has(row.divisionId)) continue;
    const ok = await insertStat(dabosSql, {
      workspaceId,
      divisionId: row.divisionId,
      departmentId: row.departmentId,
      metricKey: row.metricKey,
      value: row.value,
      recordedAt,
      basis: { ...windowBasis, source: row.source, ...(row.basis ?? {}) },
      recordedBy: 'week-close-poster',
    });
    if (ok) inserted.push(`${row.divisionId}.${row.metricKey}`);
  }

  // Proviso Abrechnung monthly income → Div3 (workspace per Monat)
  const monthsToPost = only && !only.has('Div3') ? 0 : (opts.includeProvisoMonths ?? 6);
  try {
    // --only without Div3 (e.g. a Div1 backfill) never opens the Proviso DB.
    const months = monthsToPost > 0 ? readProvisoMonthlyIncome().slice(0, monthsToPost) : [];
    if (monthsToPost > 0 && months.length === 0) {
      notes.push('Proviso income skipped — DB missing or no commission_events for VB');
    }
    for (const m of months) {
      const [mm, yyyy] = m.monat.split('.');
      const ws = `proviso-${yyyy}-${mm}`;
      // Last day of Abrechnung Monat (JS: day 0 of next month index)
      const recorded = new Date(Date.UTC(Number(yyyy), Number(mm), 0, 22, 0, 0)).toISOString();
      const provisoRows: Array<{
        divisionId: string;
        departmentId: string | null;
        metricKey: string;
      }> = [
        { divisionId: 'Div3', departmentId: null, metricKey: 'taxable_income_eur' },
        { divisionId: 'Div3', departmentId: 'Dept7', metricKey: 'taxable_income_eur' },
        // GDS: Abrechnung residual counted as collections until a cash-register feed exists
        { divisionId: 'Div3', departmentId: null, metricKey: 'collections_eur' },
        { divisionId: 'Div3', departmentId: 'Dept7', metricKey: 'collections_eur' },
        // Exec GDS: org GI for the month (same Proviso residual for now)
        { divisionId: 'Div7', departmentId: null, metricKey: 'gross_income_eur' },
      ];
      let any = false;
      for (const pr of provisoRows) {
        const ok = await insertStat(dabosSql, {
          workspaceId: ws,
          divisionId: pr.divisionId,
          departmentId: pr.departmentId,
          metricKey: pr.metricKey,
          value: m.eur,
          recordedAt: recorded,
          basis: {
            source: 'proviso-commission_events',
            monat: m.monat,
            line_count: m.lineCount,
            vb: LW_VB,
            note:
              pr.metricKey === 'collections_eur' || pr.metricKey === 'gross_income_eur'
                ? 'Proviso Abrechnung residual EUR as collections/GI until cash daybook exists'
                : 'taxable substat (EÜR)',
          },
          recordedBy: 'week-close-poster',
        });
        if (ok) {
          any = true;
          inserted.push(`${pr.divisionId}.${pr.metricKey}@${m.monat}`);
        }
      }
      if (any) {
        notes.push(`Proviso ${m.monat}: €${m.eur} (${m.lineCount} lines) → taxable + collections + Div7 GI`);
      }
    }
  } catch (err) {
    notes.push(`Proviso income skipped: ${err instanceof Error ? err.message : String(err)}`);
  }

  return {
    workspaceId,
    recordedAt,
    window: { start: window.start.toISOString(), end: window.end.toISOString(), label: window.label },
    inserted,
    notes,
  };
}
