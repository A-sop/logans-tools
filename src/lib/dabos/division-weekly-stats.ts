/**
 * Division primary weekly/monthly stats → Neon (Dept03 / P03-1).
 * Reads local registers + Proviso Abrechnung (read-only). Never invents ship counts.
 *
 * Div map (STAT-MAP):
 *  Div2 leads_or_touchpoints_created + Dept4 content_pieces_shipped (content factory = Div2)
 *  Div3 taxable_income_eur (Proviso commission Abrechnung + other incomes as added)
 *  Div4 shipped_outputs (ship-log rows with Validated (Dept13) = PASS <date> and Counts=yes)
 *  Div5 qa_pass_rate (Dept13 checklist PASS / decided verdict instances - per instance, not per PR/SHA)
 *  Div6 conversions — GFP poster (separate module)
 *  Div7 plan_completion_rate (establishment checklist reported / total depts)
 *
 * Cron on Vercel skips local-path metrics when files/DB are absent so we do not
 * overwrite honest Neon points with zero from an empty sandbox.
 */
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { getISOWeek, getISOWeekYear, parseISO } from 'date-fns';
import type { DabosSql } from '@/lib/dabos/dabos-connection';
import {
  closedOrgWeekForIsoWeek,
  isEntryInClosedOrgWeek,
  recordedAtForClosedOrgWeek,
  REGISTER_DATE_TIME_SOURCE,
  type ClosedOrgWeek,
} from '@/lib/dabos/org-week-window';

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

const PASS_CELL_RE = new RegExp('^PASS\\s+(' + REGISTER_DATE_TIME_SOURCE + ')', 'i');

/**
 * PASS date from a ship-log 'Validated (Dept13)' cell, e.g. '**PASS 2026-07-11** (instance 3)'.
 * Returns null for FAIL, CONDITIONAL, pending ('PASS (pending ...)', 'pending PASS'), or no date.
 */
export function shipLogPassDate(validatedCell: string): string | null {
  const cell = validatedCell.replace(/\*/g, '').trim();
  if (/pending/i.test(cell)) return null;
  const m = PASS_CELL_RE.exec(cell);
  return m?.[1] ?? null;
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

const VERDICT_LINE_RE = /^[\s>*-]*\**\s*Verdict\s*:\s*(?:\*+\s*)*(PASS|FAIL)\b(.*)$/im;
const VALIDATED_ON_RE = new RegExp(
  '\\**\\s*Validated on\\s*:\\s*\\**\\s*(' + REGISTER_DATE_TIME_SOURCE + ')',
  'i'
);

/**
 * Decided verdict of one Dept13 checklist instance: PASS / FAIL, or null when absent, empty
 * template, CONDITIONAL, or pending ('**Verdict: PASS** (pending formal Dept13 ...)').
 * Accepts '**Verdict: PASS**', '**Verdict:** FAIL' and unbolded 'Verdict: FAIL'.
 */
export function instanceVerdict(block: string): 'PASS' | 'FAIL' | null {
  const m = VERDICT_LINE_RE.exec(block);
  if (!m?.[1]) return null;
  if (/pending/i.test(m[2] ?? '')) return null;
  return m[1].toUpperCase() as 'PASS' | 'FAIL';
}

/**
 * qa_pass_rate = PASS / (PASS + FAIL), counted PER VERDICT INSTANCE ('## Instance N' block in
 * the Dept13 checklist register) - not per PR and not per SHA: two instances for the same PR
 * (e.g. FAIL then PASS on a re-review) are two verdicts.
 * Weekly poster path: pass { window } and only instances whose 'Validated on:' value is inside
 * the closed org week count (isEntryInClosedOrgWeek). Legacy { year, week } scopes to the ISO
 * Mon-Sun week. Without opts: all-time. 0 verdicts in scope -> null (to-report).
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
      if ('window' in opts) {
        if (!isEntryInClosedOrgWeek(dateMatch[1], opts.window)) continue;
      } else {
        const validated = parseISO(dateMatch[1].slice(0, 10));
        if (Number.isNaN(validated.getTime())) continue;
        if (getISOWeekYear(validated) !== opts.year || getISOWeek(validated) !== opts.week) {
          continue;
        }
      }
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

export async function postDivisionWeeklyStats(opts: {
  dabosSql: DabosSql;
  /** Closed org week to post (preferred). Week-close passes closedOrgWeek(now). */
  window?: ClosedOrgWeek;
  /** Legacy: ISO week of the closing Thursday; resolved to that closed org week. */
  year?: number;
  week?: number;
  includeProvisoMonths?: number;
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

  const rows: Array<{
    divisionId: string;
    departmentId: string | null;
    metricKey: string;
    value: number;
    source: string;
  }> = [];

  if (contentStatus != null) {
    rows.push({
      divisionId: 'Div2',
      departmentId: 'Dept4',
      metricKey: 'content_pieces_shipped',
      value: contentPieces,
      source: 'content-status-table.md (all-time snapshot, not windowed)',
    });
    notes.push(
      `Div2 content_pieces_shipped=${contentPieces} (content factory / Dept4 submit-for-validation)`
    );
  } else {
    notes.push(`Div2 content_pieces_shipped skipped — missing ${contentStatusPath}`);
  }

  if (pipeline != null) {
    rows.push({
      divisionId: 'Div2',
      departmentId: null,
      metricKey: 'leads_or_touchpoints_created',
      value: touchpoints,
      source: 'pipeline-register.md (open prospects snapshot, not windowed)',
    });
    notes.push(`Div2 leads_or_touchpoints_created=${touchpoints}`);
  } else {
    notes.push(`Div2 leads_or_touchpoints_created skipped — missing ${pipelinePath}`);
  }

  if (shipLog != null) {
    rows.push(
      {
        divisionId: 'Div4',
        departmentId: null,
        metricKey: 'shipped_outputs',
        value: shipped,
        source: 'docs/registers/ship-log.md Counts=yes, Date in closed week',
      },
      {
        divisionId: 'Div4',
        departmentId: 'Dept12',
        metricKey: 'shipped_outputs',
        value: shipped,
        source: 'docs/registers/ship-log.md Counts=yes, Date in closed week',
      }
    );
    notes.push(`Div4 shipped_outputs=${shipped} (ship-log Counts=yes, dated in closed week)`);
  } else {
    notes.push(`Div4 shipped_outputs skipped — missing ${SHIP_LOG}`);
  }

  if (qaRate != null) {
    rows.push({
      divisionId: 'Div5',
      departmentId: null,
      metricKey: 'qa_pass_rate',
      value: qaRate,
      source: 'docs/registers/dept13-validation-checklists.md Validated on in closed week',
    });
    notes.push(`Div5 qa_pass_rate=${qaRate}`);
  } else {
    notes.push('Div5 qa_pass_rate to-report (no row posted): 0 Dept13 verdicts validated in the closed week');
  }

  if (planRate != null) {
    rows.push({
      divisionId: 'Div7',
      departmentId: null,
      metricKey: 'plan_completion_rate',
      value: planRate,
      source: 'establishment-checklist.md (snapshot)',
    });
    notes.push(`Div7 plan_completion_rate=${planRate}`);
  } else {
    notes.push('Div7 plan_completion_rate skipped — establishment checklist unreadable');
  }

  for (const row of rows) {
    const ok = await insertStat(dabosSql, {
      workspaceId,
      divisionId: row.divisionId,
      departmentId: row.departmentId,
      metricKey: row.metricKey,
      value: row.value,
      recordedAt,
      basis: { ...windowBasis, source: row.source },
      recordedBy: 'week-close-poster',
    });
    if (ok) inserted.push(`${row.divisionId}.${row.metricKey}`);
  }

  // Proviso Abrechnung monthly income → Div3 (workspace per Monat)
  const monthsToPost = opts.includeProvisoMonths ?? 6;
  try {
    const months = readProvisoMonthlyIncome().slice(0, monthsToPost);
    if (months.length === 0) {
      notes.push('Proviso income skipped — DB missing or no commission_events for VB');
    }
    for (const m of months) {
      const [mm, yyyy] = m.monat.split('.');
      const ws = `proviso-${yyyy}-${mm}`;
      // Last day of Abrechnung Monat (JS: day 0 of next month index)
      const recorded = new Date(Date.UTC(Number(yyyy), Number(mm), 0, 22, 0, 0)).toISOString();
      const okDiv = await insertStat(dabosSql, {
        workspaceId: ws,
        divisionId: 'Div3',
        departmentId: null,
        metricKey: 'taxable_income_eur',
        value: m.eur,
        recordedAt: recorded,
      });
      const okDept = await insertStat(dabosSql, {
        workspaceId: ws,
        divisionId: 'Div3',
        departmentId: 'Dept7',
        metricKey: 'taxable_income_eur',
        value: m.eur,
        recordedAt: recorded,
      });
      if (okDiv || okDept) {
        inserted.push(`Div3.taxable_income_eur@${m.monat}`);
        notes.push(`Proviso ${m.monat}: €${m.eur} (${m.lineCount} Abrechnung lines, VB ${LW_VB})`);
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
