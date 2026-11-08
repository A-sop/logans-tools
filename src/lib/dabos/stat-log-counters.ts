/**
 * Counters for optional weekly logs under dabos-registers (and DABOS docs/registers mirrors).
 * Missing file → null (to-report). Present file → number (0 OK).
 */
import { existsSync, readFileSync } from 'fs';
import {
  isEntryInClosedOrgWeek,
  type ClosedOrgWeek,
} from '@/lib/dabos/org-week-window';

export type WeekWindow = Pick<ClosedOrgWeek, 'start' | 'end' | 'startDate' | 'endDate'>;

export function readOptionalText(filePath: string): string | null {
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath, 'utf8');
}

/** Table rows that look like `| 2026-11-06 | ...` (date in first data cell). */
function dataRows(md: string): string[] {
  return md.split('\n').filter((line) => /^\|\s*\d{4}-\d{2}-\d{2}/.test(line));
}

function cells(row: string): string[] {
  return row.split('|').map((c) => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
}

/**
 * Sum numeric column for rows whose Date is in the closed org week.
 * colIndex is 0-based among data cells after splitting (0 = Date).
 */
export function sumLogColumn(
  md: string | null,
  window: WeekWindow,
  valueColIndex: number,
  filter?: (cells: string[]) => boolean
): number | null {
  if (md == null) return null;
  let sum = 0;
  for (const row of dataRows(md)) {
    const c = cells(row);
    const date = c[0] ?? '';
    if (!isEntryInClosedOrgWeek(date, window)) continue;
    if (filter && !filter(c)) continue;
    const raw = (c[valueColIndex] ?? '').replace(/[€,\s]/g, '');
    const n = Number(raw);
    if (!Number.isFinite(n)) continue;
    sum += n;
  }
  return sum;
}

/** Count rows in window (optionally filtered). */
export function countLogRows(
  md: string | null,
  window: WeekWindow,
  filter?: (cells: string[]) => boolean
): number | null {
  if (md == null) return null;
  let n = 0;
  for (const row of dataRows(md)) {
    const c = cells(row);
    if (!isEntryInClosedOrgWeek(c[0] ?? '', window)) continue;
    if (filter && !filter(c)) continue;
    n += 1;
  }
  return n;
}

/** Comms log: | Date | Direction | Channel | Units | Note | */
export function countCommsUnits(
  md: string | null,
  window: WeekWindow,
  direction: 'in' | 'out'
): number | null {
  return sumLogColumn(md, window, 3, (c) => (c[1] ?? '').toLowerCase() === direction);
}

/** Enrollments: | Date | Venture | Client | Product | Note | → row count */
export function countEnrollments(md: string | null, window: WeekWindow): number | null {
  return countLogRows(md, window);
}

/** Product sales: | Date | Venture | SKU | Qty | EUR | Note | → sum Qty */
export function countProductSalesQty(md: string | null, window: WeekWindow): number | null {
  return sumLogColumn(md, window, 3);
}

/** Publish log: | Date | Item | Channel | Venture | … | → row count in window */
export function countPublishLogRows(md: string | null, window: WeekWindow): number | null {
  return countLogRows(md, window);
}

/**
 * Trading research: | Date | Venture | Kind | Units | Note |
 * researchKinds=true → Kind ≠ paper_test; false → Kind = paper_test only.
 */
export function sumTradingResearchUnits(
  md: string | null,
  window: WeekWindow,
  paperTestsOnly: boolean
): number | null {
  return sumLogColumn(md, window, 3, (c) => {
    const kind = (c[2] ?? '').toLowerCase().trim();
    if (!kind) return false;
    const isPaper = kind === 'paper_test' || kind === 'paper-test' || kind === 'backtest';
    return paperTestsOnly ? isPaper : !isPaper;
  });
}

/** Market research: | Date | Venture | Topic | Units | Note | → sum Units (blank Units = 1) */
export function sumMarketResearchUnits(md: string | null, window: WeekWindow): number | null {
  if (md == null) return null;
  let sum = 0;
  for (const row of dataRows(md)) {
    const c = cells(row);
    if (!isEntryInClosedOrgWeek(c[0] ?? '', window)) continue;
    const raw = (c[3] ?? '').replace(/[€,\s]/g, '');
    const n = Number(raw);
    sum += Number.isFinite(n) && raw !== '' ? n : 1;
  }
  return sum;
}

/** EUR logs: | Date | … | EUR | … | with EUR at valueColIndex */
export function sumEurLog(
  md: string | null,
  window: WeekWindow,
  eurColIndex: number
): number | null {
  return sumLogColumn(md, window, eurColIndex);
}

/** Dept13: decided verdicts in window (PASS+FAIL). */
export function countVerdictsDecided(
  validationMd: string | null,
  window: WeekWindow,
  instanceVerdict: (block: string) => 'PASS' | 'FAIL' | null,
  validatedOnRe: RegExp
): number | null {
  if (validationMd == null) return null;
  const blocks = validationMd.split(/^## Instance\s+\d+/im).slice(1);
  if (blocks.length === 0) return 0;
  let n = 0;
  for (const block of blocks) {
    if (!instanceVerdict(block)) continue;
    const dateMatch = validatedOnRe.exec(block);
    if (!dateMatch?.[1]) continue;
    if (!isEntryInClosedOrgWeek(dateMatch[1], window)) continue;
    n += 1;
  }
  return n;
}
