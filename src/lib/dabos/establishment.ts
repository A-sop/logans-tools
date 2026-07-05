/**
 * E3 establishment sprint (T2): per-department establishment flags + stat status
 * for the org board and drilldowns. Data seeded by migration 009 from
 * DABOS/docs/reference/dept-briefs/establishment-checklist.md.
 */
import type { DabosSql } from '@/lib/dabos/dabos-connection';

export type DeptEstablishment = {
  department_id: string;
  hat_confirmed: boolean;
  stat_defined: boolean;
  comm_line_named: boolean;
  first_output_named: boolean;
  comm_line: string | null;
  stat_status: 'reported' | 'to-report';
  stat_metric_key: string | null;
  stat_pointer: string | null;
  /** Latest reported value for stat_metric_key; null for to-report rows. */
  stat_value: number | null;
  checked_at: string | null;
};

function mapRow(row: Record<string, unknown>): DeptEstablishment {
  return {
    department_id: row.department_id as string,
    hat_confirmed: Boolean(row.hat_confirmed),
    stat_defined: Boolean(row.stat_defined),
    comm_line_named: Boolean(row.comm_line_named),
    first_output_named: Boolean(row.first_output_named),
    comm_line: (row.comm_line as string | null) ?? null,
    stat_status: row.stat_status as 'reported' | 'to-report',
    stat_metric_key: (row.stat_metric_key as string | null) ?? null,
    stat_pointer: (row.stat_pointer as string | null) ?? null,
    stat_value: row.stat_value != null ? Number(row.stat_value) : null,
    checked_at: row.checked_at
      ? new Date(row.checked_at as string).toISOString().slice(0, 10)
      : null,
  };
}

/** Establishment rows for all departments, keyed by department id. */
export async function fetchDeptEstablishmentMap(
  sql: DabosSql
): Promise<Map<string, DeptEstablishment>> {
  const map = new Map<string, DeptEstablishment>();
  try {
    const rows = await sql`
      SELECT
        e.department_id,
        e.hat_confirmed,
        e.stat_defined,
        e.comm_line_named,
        e.first_output_named,
        e.comm_line,
        e.stat_status,
        e.stat_metric_key,
        e.stat_pointer,
        e.checked_at,
        latest.value AS stat_value
      FROM department_establishment e
      LEFT JOIN LATERAL (
        SELECT s.value::float8 AS value
        FROM stats s
        WHERE s.department_id = e.department_id
          AND s.metric_key = e.stat_metric_key
        ORDER BY s.recorded_at DESC
        LIMIT 1
      ) latest ON e.stat_metric_key IS NOT NULL
    `;
    for (const row of rows) {
      map.set(row.department_id as string, mapRow(row));
    }
  } catch {
    /* department_establishment table may be missing before migration 009 */
  }
  return map;
}

/** Establishment row for one department (drilldown). */
export async function fetchDeptEstablishment(
  sql: DabosSql,
  deptId: string
): Promise<DeptEstablishment | null> {
  const map = await fetchDeptEstablishmentMap(sql);
  return map.get(deptId) ?? null;
}
