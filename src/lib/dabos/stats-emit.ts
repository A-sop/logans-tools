/**
 * Unified Neon stats write path (ideal Layer A / F).
 * All posters and event emitters should go through emitStat — never raw INSERT.
 */
import type { DabosSql } from '@/lib/dabos/dabos-connection';

export type StatEmitInput = {
  workspaceId: string;
  divisionId: string;
  departmentId?: string | null;
  metricKey: string;
  value: number;
  recordedAt?: string;
  /** Provenance — file path, query, ship row id, or "honest empty" */
  basis: Record<string, unknown> | string;
  /** Emitter id: week-close-poster | ship-gate | gfp-poster | … */
  recordedBy: string;
  /**
   * insert_if_absent — weekly posters (idempotent per workspace+metric).
   * insert_always — event emits with unique workspace_id (ship-gate).
   */
  mode?: 'insert_if_absent' | 'insert_always';
};

export type StatEmitResult = {
  inserted: boolean;
  id?: string;
};

function normalizeBasis(basis: StatEmitInput['basis']): Record<string, unknown> {
  if (typeof basis === 'string') return { note: basis };
  return basis;
}

export async function emitStat(
  dabosSql: DabosSql,
  input: StatEmitInput
): Promise<StatEmitResult> {
  const recordedAt = input.recordedAt ?? new Date().toISOString();
  const basis = normalizeBasis(input.basis);
  const departmentId = input.departmentId ?? null;
  const mode = input.mode ?? 'insert_if_absent';

  if (mode === 'insert_always') {
    const rows = await dabosSql`
      INSERT INTO stats (
        workspace_id, division_id, department_id, metric_key, value,
        recorded_at, basis, recorded_by
      )
      VALUES (
        ${input.workspaceId},
        ${input.divisionId},
        ${departmentId},
        ${input.metricKey},
        ${input.value},
        ${recordedAt}::timestamptz,
        ${JSON.stringify(basis)}::jsonb,
        ${input.recordedBy}
      )
      RETURNING id
    `;
    return { inserted: Boolean(rows[0]?.id), id: rows[0]?.id as string | undefined };
  }

  const rows = await dabosSql`
    INSERT INTO stats (
      workspace_id, division_id, department_id, metric_key, value,
      recorded_at, basis, recorded_by
    )
    SELECT
      ${input.workspaceId},
      ${input.divisionId},
      ${departmentId},
      ${input.metricKey},
      ${input.value},
      ${recordedAt}::timestamptz,
      ${JSON.stringify(basis)}::jsonb,
      ${input.recordedBy}
    WHERE NOT EXISTS (
      SELECT 1 FROM stats s
      WHERE s.workspace_id = ${input.workspaceId}
        AND s.division_id = ${input.divisionId}
        AND s.department_id IS NOT DISTINCT FROM ${departmentId}
        AND s.metric_key = ${input.metricKey}
    )
    RETURNING id
  `;
  return { inserted: Boolean(rows[0]?.id), id: rows[0]?.id as string | undefined };
}
