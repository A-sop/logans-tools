/**
 * Read-only rollback CSV for the one-off re-basketing (and normalisation) touch set.
 * Columns: id,basket,status,assigned_agent,division_id,department_id,ingest_meta
 */
import { createHash } from 'crypto';

import { mapRebasketStatus } from '@/lib/dabos/comm-center/pending';
import {
  ASSIGNED_AGENT_POST_MAP,
  DEPARTMENT_ID_MAP,
  DIVISION_ID_MAP,
} from '@/lib/dabos/comm-center/posts';

export type TouchRow = {
  id: string;
  basket: string;
  status: string;
  assigned_agent: string | null;
  division_id: string;
  department_id: string | null;
  ingest_meta: unknown;
};

export const ROLLBACK_CSV_HEADER =
  'id,basket,status,assigned_agent,division_id,department_id,ingest_meta';

function csvEscape(v: string): string {
  if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function cell(v: string | null | undefined): string {
  if (v == null) return '';
  return csvEscape(v);
}

export function rowToCsvLine(row: TouchRow): string {
  const meta =
    typeof row.ingest_meta === 'string'
      ? row.ingest_meta
      : JSON.stringify(row.ingest_meta ?? {});
  return [
    cell(row.id),
    cell(row.basket),
    cell(row.status),
    cell(row.assigned_agent),
    cell(row.division_id),
    cell(row.department_id),
    cell(meta),
  ].join(',');
}

export function buildRollbackCsv(rows: TouchRow[]): { csv: string; sha256: string; count: number } {
  const lines = [ROLLBACK_CSV_HEADER, ...rows.map(rowToCsvLine)];
  const csv = `${lines.join('\n')}\n`;
  const sha256 = createHash('sha256').update(csv, 'utf8').digest('hex');
  return { csv, sha256, count: rows.length };
}

/** Rows the re-basket SQL will touch: basket='in' with a mapped status. */
export function isRebasketTouchRow(row: Pick<TouchRow, 'basket' | 'status'>): boolean {
  return row.basket === 'in' && mapRebasketStatus(row.status) !== null;
}

/** Rows normalisation may rewrite (non-canonical agent/div/dept strings). */
export function needsNormalisation(row: Pick<TouchRow, 'assigned_agent' | 'division_id' | 'department_id'>): boolean {
  const agent = row.assigned_agent;
  if (agent != null && agent !== '' && !(agent in ASSIGNED_AGENT_POST_MAP)) {
    // capability agents (research, …) are left alone — only rewrite when value looks like a post/dept variant
    const looksPost =
      /^(div|dept|ldw)/i.test(agent) || agent.includes(' ') || agent !== agent.trim();
    if (looksPost) return true;
  }
  if (agent != null && agent in ASSIGNED_AGENT_POST_MAP && ASSIGNED_AGENT_POST_MAP[agent] !== agent) {
    return true;
  }
  if (!(row.division_id in DIVISION_ID_MAP)) return true;
  if (DIVISION_ID_MAP[row.division_id] !== row.division_id) return true;
  const dept = row.department_id;
  if (dept != null && dept !== '') {
    if (!(dept in DEPARTMENT_ID_MAP)) return true;
    if (DEPARTMENT_ID_MAP[dept] !== dept) return true;
  }
  return false;
}

/** SQL the exporter runs (read-only). Touch set = in-basket rows that re-basket or normalise. */
export const ROLLBACK_SELECT_SQL = `
SELECT id::text AS id,
       basket,
       status,
       assigned_agent,
       division_id,
       department_id,
       ingest_meta
  FROM tasks
 WHERE basket = 'in'
    OR assigned_agent IS NOT NULL
 ORDER BY id
`;
