/**
 * Week-close condition REPORT (Dept11 fix, 2026-10-29 - Dept13 FAIL on the W44 poster).
 *
 * The week-close poster reports each division's condition; it does not assign one.
 * A condition is only reported when it was actually recorded for the division:
 *   - condition_source = 'founder_ruling' AND a non-empty ruling_date AND ruling_ref
 *     (a founder_ruling row missing either is reported as 'to-report'), or
 *   - condition_source = 'formula' (verified EP / formula advance).
 * Anything else - no row, or a 'computed' row (stat trend or the Non-Existence seed
 * default) - is reported as 'to-report'. The poster never defaults a division to
 * Non-Existence and never writes condition state.
 */
import type { DabosSql } from '@/lib/dabos/dabos-connection';

export const TO_REPORT = 'to-report' as const;

export type RecordedConditionRow = {
  entity_id: string;
  working_condition: string | null;
  condition_source: string | null;
  ruling_date?: string | null;
  ruling_ref?: string | null;
};

export type ReportedCondition = {
  entity_id: string;
  condition: string;
  source: 'founder_ruling' | 'formula' | typeof TO_REPORT;
  ruling_date: string | null;
  ruling_ref: string | null;
};

const RECORDED_SOURCES = new Set(['founder_ruling', 'formula']);

export function reportDivisionConditions(
  divisionIds: string[],
  rows: RecordedConditionRow[]
): ReportedCondition[] {
  const byId = new Map(rows.map((r) => [r.entity_id, r]));
  return divisionIds.map((id) => {
    const row = byId.get(id);
    const condition = row?.working_condition?.trim();
    const source = row?.condition_source ?? '';
    const rulingDate = row?.ruling_date?.trim() || null;
    const rulingRef = row?.ruling_ref?.trim() || null;
    const evidenced = source !== 'founder_ruling' || (rulingDate !== null && rulingRef !== null);
    if (row && condition && RECORDED_SOURCES.has(source) && evidenced) {
      return {
        entity_id: id,
        condition,
        source: source as 'founder_ruling' | 'formula',
        ruling_date: rulingDate,
        ruling_ref: rulingRef,
      };
    }
    return { entity_id: id, condition: TO_REPORT, source: TO_REPORT, ruling_date: null, ruling_ref: null };
  });
}

/** Read-only: divisions + their recorded condition state. */
export async function loadReportedDivisionConditions(sql: DabosSql): Promise<ReportedCondition[]> {
  const divisions = await sql`SELECT id FROM divisions ORDER BY id`;
  const rows = await sql`
    SELECT entity_id, working_condition, condition_source,
           ruling_date::text AS ruling_date, ruling_ref
    FROM entity_condition_state
    WHERE entity_type = 'division'
  `;
  return reportDivisionConditions(
    divisions.map((d) => d.id as string),
    rows.map((r) => ({
      entity_id: r.entity_id as string,
      working_condition: (r.working_condition as string | null) ?? null,
      condition_source: (r.condition_source as string | null) ?? null,
      ruling_date: (r.ruling_date as string | null) ?? null,
      ruling_ref: (r.ruling_ref as string | null) ?? null,
    }))
  );
}