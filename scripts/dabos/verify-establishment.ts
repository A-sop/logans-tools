#!/usr/bin/env npx tsx
/**
 * E3 sprint acceptance (T1 + T2 data path).
 *
 * T1: querying the DB returns 21 departments, each with the four establishment
 *     flags and either a reported stat value or a to-report pointer.
 * T2: the org-board data path (board conditions + establishment map) returns a
 *     full row per department and every working condition reads Non-Existence.
 *
 * Usage: npm run dabos:verify-establishment
 */
import { evaluateBoardConditionsWithSql } from '../../src/lib/dabos/board-conditions-query';
import { createDabosSql } from '../../src/lib/dabos/dabos-connection';
import { fetchDeptEstablishmentMap } from '../../src/lib/dabos/establishment';
import { requireDatabaseUrl } from './load-env';

function flag(v: boolean): string {
  return v ? 'Y' : 'x';
}

async function main() {
  const url = requireDatabaseUrl();
  const sql = createDabosSql(url);

  // --- T1 acceptance query (departments x establishment x latest stat) ---
  const rows = await sql`
    SELECT
      d.id,
      e.hat_confirmed,
      e.stat_defined,
      e.comm_line_named,
      e.first_output_named,
      e.stat_status,
      e.stat_metric_key,
      e.stat_pointer,
      latest.value AS stat_value
    FROM departments d
    LEFT JOIN department_establishment e ON e.department_id = d.id
    LEFT JOIN LATERAL (
      SELECT s.value::float8 AS value
      FROM stats s
      WHERE s.department_id = d.id
        AND s.metric_key = e.stat_metric_key
      ORDER BY s.recorded_at DESC
      LIMIT 1
    ) latest ON e.stat_metric_key IS NOT NULL
    ORDER BY (regexp_replace(d.id, '\\D', '', 'g'))::int
  `;

  let failures = 0;
  let reported = 0;
  for (const r of rows) {
    const hasFlags =
      r.hat_confirmed != null &&
      r.stat_defined != null &&
      r.comm_line_named != null &&
      r.first_output_named != null;
    const hasValue = r.stat_status === 'reported' && r.stat_value != null;
    const hasPointer = r.stat_status === 'to-report' && !!r.stat_pointer;
    if (hasValue) reported += 1;
    const ok = hasFlags && (hasValue || hasPointer);
    if (!ok) failures += 1;

    const boxes = hasFlags
      ? `hat:${flag(r.hat_confirmed as boolean)} stat:${flag(r.stat_defined as boolean)} comm:${flag(r.comm_line_named as boolean)} first:${flag(r.first_output_named as boolean)}`
      : 'MISSING ESTABLISHMENT ROW';
    const statPart = hasValue
      ? `reported ${r.stat_metric_key} = ${r.stat_value}`
      : hasPointer
        ? `to-report -> ${r.stat_pointer}`
        : 'MISSING STAT VALUE/POINTER';
    console.log(`${String(r.id).padEnd(7)} ${boxes}  ${statPart}${ok ? '' : '  <-- FAIL'}`);
  }

  console.log('');
  console.log(
    `T1: departments: ${rows.length} · reported stats: ${reported} · failures: ${failures}`
  );

  // --- T2 data path: board conditions + establishment map (what /dabos renders) ---
  const board = await evaluateBoardConditionsWithSql(sql);
  const establishment = await fetchDeptEstablishmentMap(sql);

  let boardFailures = 0;
  const nonNe: string[] = [];
  for (const r of rows) {
    const id = r.id as string;
    const condition = board.departments.get(id)?.condition ?? null;
    const est = establishment.get(id);
    const hasStatOrPointer =
      est != null &&
      ((est.stat_status === 'reported' && est.stat_value != null) ||
        (est.stat_status === 'to-report' && !!est.stat_pointer));
    if (!est || !hasStatOrPointer) boardFailures += 1;
    if (condition !== 'Non-Existence') nonNe.push(`${id}=${condition ?? 'null'}`);
  }
  console.log(
    `T2: board rows with flags+stat: ${rows.length - boardFailures}/${rows.length} · ` +
      `non-Non-Existence conditions: ${nonNe.length ? nonNe.join(', ') : 'none'}`
  );

  if ('end' in sql && typeof sql.end === 'function') {
    await sql.end({ timeout: 5 });
  }

  if (rows.length !== 21 || failures > 0 || reported !== 6 || boardFailures > 0 || nonNe.length > 0) {
    console.error('FAIL: acceptance not met (21 depts, 6 reported, all Non-Existence, 0 failures)');
    process.exit(1);
  }
  console.log('ESTABLISHMENT_OK — every dept shows 4 flags and a stat value or pointer');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
