/**
 * Read-only snapshot of stats table — workspace coverage and June cutoff.
 * Run: npx tsx scripts/dabos/query-stats-snapshot.ts
 *
 * SUPERSEDE EXEMPTION (migration 021, deliberate): this is a RAW DIAGNOSTIC view of the
 * stats table. Its queries intentionally do NOT filter `superseded_at IS NULL`, so the
 * snapshot shows every physical row, including superseded ones, for auditing a correction.
 * It feeds no board, condition, crawl or plan. Do not reuse these queries as readers.
 */
import { requireDatabaseUrl } from './load-env';
import { createDabosSql } from '../../src/lib/dabos/dabos-connection';

async function main() {
  const url = requireDatabaseUrl();
  const sql = createDabosSql(url);

  const workspaces = await sql`
    SELECT workspace_id, COUNT(*)::int AS n,
           MIN(recorded_at)::text AS min_at,
           MAX(recorded_at)::text AS max_at
    FROM stats -- raw diagnostic: includes superseded rows (see header)
    GROUP BY workspace_id
    ORDER BY workspace_id
  `;

  console.log('=== stats by workspace_id ===');
  for (const r of workspaces) console.log(r);

  const throughJune = await sql`
    SELECT division_id, metric_key, COUNT(*)::int AS points,
           MIN(recorded_at)::date AS from_d,
           MAX(recorded_at)::date AS to_d
    FROM stats -- raw diagnostic: includes superseded rows (see header)
    WHERE recorded_at < '2026-07-01'::timestamptz
    GROUP BY division_id, metric_key
    ORDER BY division_id, metric_key
  `;

  console.log('\n=== division stats through 2026-06-30 ===');
  for (const r of throughJune) console.log(r);

  const dept12 = await sql`
    SELECT e.stat_status, e.stat_metric_key, e.stat_pointer
    FROM department_establishment e
    WHERE e.department_id = 'Dept12'
  `;

  const dept12Stat = await sql`
    SELECT workspace_id, value, recorded_at::text
    FROM stats -- raw diagnostic: includes superseded rows (see header)
    WHERE department_id = 'Dept12' AND metric_key = 'shipped_outputs'
    ORDER BY recorded_at DESC
    LIMIT 5
  `;

  const nullWs = await sql`
    SELECT division_id, department_id, metric_key, value::float8, recorded_at::date
    FROM stats -- raw diagnostic: includes superseded rows (see header)
    WHERE workspace_id IS NULL
    ORDER BY recorded_at
  `;

  console.log('\n=== stats with null workspace_id ===');
  for (const r of nullWs) console.log(r);
  console.log(dept12[0]);
  console.log('=== Dept12 shipped_outputs stats (latest) ===');
  for (const r of dept12Stat) console.log(r);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
