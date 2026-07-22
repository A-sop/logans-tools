/**
 * Post Dept1 hat_corrections_shipped for DATA root / filing-catchall cycle (2026-07-16).
 * Evidence: DABOS flap-2026-07-16-data-root-xx-filing-points.md + Atlas file-storage-architecture.md
 *
 * Run from logans-tools: npx tsx scripts/dabos/post-hat-correction-data-filing-2026-07-16.ts
 * Idempotent on workspace_id.
 */
import { createDabosSql } from '../../src/lib/dabos/dabos-connection';
import { requireDatabaseUrl } from './load-env';

const WORKSPACE = 'hat-corr-2026-07-16-data-filing';
const RECORDED_AT = '2026-07-16T22:45:00+02:00';

async function main() {
  const sql = createDabosSql(requireDatabaseUrl());

  const inserted = await sql`
    INSERT INTO stats (workspace_id, division_id, department_id, metric_key, value, recorded_at)
    SELECT ${WORKSPACE}, 'Div1', 'Dept1', 'hat_corrections_shipped', 1::numeric, ${RECORDED_AT}::timestamptz
    WHERE NOT EXISTS (
      SELECT 1 FROM stats s
      WHERE s.workspace_id = ${WORKSPACE}
        AND s.department_id = 'Dept1'
        AND s.metric_key = 'hat_corrections_shipped'
    )
    RETURNING id, metric_key, value
  `;

  await sql`
    INSERT INTO role_runs (role_id, role_type, summary_json)
    VALUES (
      'Dept1',
      'department',
      ${JSON.stringify({
        event: 'hat_correction',
        workspace_id: WORKSPACE,
        metric_key: 'hat_corrections_shipped',
        value: 1,
        summary:
          'DATA root XX-only + no-catchall filing: cleaned illegal DATA peers, added 50_TOOLS, flat dabos-registers, Atlas-CRM path, architecture/harness/hat updates. Recurrence prevented via standing orders + architecture SSOT.',
        evidence: [
          'DABOS/docs/reference/founder-office/flap-2026-07-16-data-root-xx-filing-points.md',
          'Atlas/docs/document-organisation/file-storage-architecture.md',
          'C:\\DATA\\README.txt',
          'C:\\DATA\\10_WORK\\Atlas-CRM\\',
        ],
        dept3_spot_check: 'pending',
      })}::jsonb
    )
  `;

  try {
    await sql`
      UPDATE department_establishment SET
        stat_status = 'reported',
        stat_metric_key = COALESCE(stat_metric_key, 'hat_corrections_shipped'),
        checked_at = '2026-07-16',
        updated_at = NOW()
      WHERE department_id = 'Dept1'
    `;
  } catch {
    console.log('(department_establishment update skipped — table/columns may differ)');
  }

  if (inserted.length === 0) {
    console.log(`${WORKSPACE}: hat_corrections_shipped already present (idempotent)`);
  } else {
    console.log(`${WORKSPACE}: inserted hat_corrections_shipped=${inserted[0].value}`);
  }
  console.log('role_runs: Dept1 hat correction receipt logged');

  if ('end' in sql && typeof sql.end === 'function') {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
