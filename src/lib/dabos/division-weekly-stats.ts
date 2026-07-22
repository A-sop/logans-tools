/**
 * Division primary weekly/monthly stats → Neon (Dept03 / P03-1).
 * Reads local registers + Proviso Abrechnung (read-only). Never invents ship counts.
 *
 * Div map (STAT-MAP):
 *  Div2 leads_or_touchpoints_created + Dept4 content_pieces_shipped (content factory = Div2)
 *  Div3 taxable_income_eur (Proviso commission Abrechnung + other incomes as added)
 *  Div4 shipped_outputs (ship-log Counts=yes rows)
 *  Div5 qa_pass_rate (Dept13 checklist PASS / decided instances)
 *  Div6 conversions — GFP poster (separate module)
 *  Div7 plan_completion_rate (establishment checklist reported / total depts)
 *
 * Cron on Vercel skips local-path metrics when files/DB are absent so we do not
 * overwrite honest Neon points with zero from an empty sandbox.
 */
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { endOfISOWeek, setISOWeek, startOfYear } from 'date-fns';
import type { DabosSql } from '@/lib/dabos/dabos-connection';

export type DivisionWeeklyResult = {
  workspaceId: string;
  recordedAt: string;
  inserted: string[];
  notes: string[];
};

const REGISTERS = path.join('C:', 'DATA', '10_WORK', 'dabos-registers');
const SHIP_LOG = path.join('C:', 'Dev', 'DABOS', 'docs', 'registers', 'ship-log.md');
const VALIDATION = path.join(
  'C:',
  'Dev',
  'DABOS',
  'docs',
  'registers',
  'dept13-validation-checklists.md'
);
const ESTABLISHMENT = path.join(
  'C:',
  'Dev',
  'DABOS',
  'docs',
  'reference',
  'dept-briefs',
  'establishment-checklist.md'
);
const DEFAULT_PROVISO_DB = path.join('C:', 'Dev', 'proviso', 'data', 'proviso.db');
const LW_VB = 2106750;

function weekEndIso(year: number, week: number): string {
  return endOfISOWeek(setISOWeek(startOfYear(new Date(year, 0, 4)), week)).toISOString();
}

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

/** Ship-log rows with Counts = yes (case-insensitive). */
export function countShippedOutputs(shipLogMd: string | null): number {
  if (!shipLogMd) return 0;
  const tableStart = shipLogMd.indexOf('| # | Date |');
  if (tableStart < 0) return 0;
  const section = shipLogMd.slice(tableStart);
  const rows = section.split('\n').filter((line) => /^\|\s*\d+\s*\|/.test(line));
  return rows.filter((row) => {
    const cells = row.split('|').map((c) => c.trim());
    const counts = (cells[cells.length - 2] ?? '').toLowerCase().replace(/\*/g, '');
    return counts === 'yes' || counts.startsWith('yes');
  }).length;
}

/** qa_pass_rate = PASS verdicts / (PASS+FAIL) among filled Instance verdicts. */
export function computeQaPassRate(validationMd: string | null): number | null {
  if (!validationMd) return null;
  const verdicts = [...validationMd.matchAll(/\*\*Verdict:\s*(PASS|FAIL)/gi)].map((m) =>
    m[1]!.toUpperCase()
  );
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

/** Sum Diskont-Konto (Abrechnung residual EUR) for Logan VB — local Proviso only. */
export function readProvisoMonthlyIncome(
  dbPath = process.env.PROVISO_DB_PATH?.trim() || DEFAULT_PROVISO_DB,
  vb = LW_VB
): ProvisoMonthIncome[] {
  if (!existsSync(dbPath)) return [];
  // Node 22+ built-in SQLite — no native addon; scripts/office only.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');
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
  }
): Promise<boolean> {
  const res = await dabosSql`
    insert into stats (workspace_id, division_id, department_id, metric_key, value, recorded_at)
    select ${row.workspaceId}, ${row.divisionId}, ${row.departmentId}, ${row.metricKey}, ${row.value}, ${row.recordedAt}::timestamptz
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
  year: number;
  week: number;
  includeProvisoMonths?: number;
}): Promise<DivisionWeeklyResult> {
  const { dabosSql, year, week } = opts;
  const workspaceId = `div-live-${year}-W${String(week).padStart(2, '0')}`;
  const recordedAt = weekEndIso(year, week);
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
  const shipped = countShippedOutputs(shipLog);
  const qaRate = computeQaPassRate(validation);
  const planRate = computePlanCompletionRate(checklist);

  const rows: Array<{
    divisionId: string;
    departmentId: string | null;
    metricKey: string;
    value: number;
  }> = [];

  if (contentStatus != null) {
    rows.push({
      divisionId: 'Div2',
      departmentId: 'Dept4',
      metricKey: 'content_pieces_shipped',
      value: contentPieces,
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
      },
      {
        divisionId: 'Div4',
        departmentId: 'Dept12',
        metricKey: 'shipped_outputs',
        value: shipped,
      }
    );
    notes.push(`Div4 shipped_outputs=${shipped} (ship-log Counts=yes)`);
  } else {
    notes.push(`Div4 shipped_outputs skipped — missing ${SHIP_LOG}`);
  }

  if (qaRate != null) {
    rows.push({
      divisionId: 'Div5',
      departmentId: null,
      metricKey: 'qa_pass_rate',
      value: qaRate,
    });
    notes.push(`Div5 qa_pass_rate=${qaRate}`);
  } else {
    notes.push('Div5 qa_pass_rate skipped — no Verdict lines in validation checklists');
  }

  if (planRate != null) {
    rows.push({
      divisionId: 'Div7',
      departmentId: null,
      metricKey: 'plan_completion_rate',
      value: planRate,
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

  return { workspaceId, recordedAt, inserted, notes };
}
