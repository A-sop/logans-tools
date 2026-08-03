/**
 * Post Dept9 Body receipts for 2026-07-30 HZR52 work.
 *
 * Pursuit of stats:
 * - disk_headroom_pct (Dept9 primary measurable today) — office PC sample via SSH
 * - role_runs receipt for Body readiness that makes remote headroom/backup verify possible
 *
 * Run: cd C:\Dev\logans-tools && npx tsx scripts/dabos/post-dept9-hzr52-body-2026-07-30.ts
 * Idempotent on workspace_id.
 */
import { createDabosSql } from '../../src/lib/dabos/dabos-connection';
import { emitStat } from '../../src/lib/dabos/stats-emit';
import { requireDatabaseUrl } from './load-env';

const DAY = '2026-07-30';
const RECORDED_AT = '2026-07-30T15:45:00+02:00';
const HEADROOM_WS = `headroom-hzr52-${DAY}`;
const ROLE_SUMMARY = {
  event: 'body_office_pc_readiness',
  pursuit: [
    'disk_headroom_pct — remote measure on HZR52 (office PC)',
    'backup_verified path — SSH so Body can verify without desk seat',
    'equipment health (workload half) — RAM ordered; emit after install verify',
  ],
  done: [
    'SSH laptop→HZR52 live (User LDW_HZR52; administrators_authorized_keys)',
    'Cursor reinstalled user-scope; main.js present',
    'Docs: hzr52-ssh-from-laptop.md + desk matrix + onboarding pointers',
    '4×16 GB DDR4-3200 SO-DIMM ordered (laptop + HZR → 32 GB each)',
  ],
  evidence: [
    'DABOS/docs/reference/dept09-assets/hzr52-ssh-from-laptop.md',
    'DABOS/docs/reference/dept09-assets/hzr52-office-pc-desk-software.md',
    'DABOS/scripts/dept09-assets/Bootstrap-Hzr52SshFromLaptop.ps1',
    'ssh hzr52 whoami → hzr52\\ldw_hzr52',
    'HZR C: HEADROOM_PCT=74.3 (2026-07-30 via SSH)',
  ],
  fleet_note:
    'Board fleet disk_headroom_pct historically = min(office, ln01, ln02). This emit is office-pc only; refresh ln01/ln02 before claiming fleet min.',
};

async function main() {
  const sql = createDabosSql(requireDatabaseUrl());

  const headroom = await emitStat(sql, {
    workspaceId: HEADROOM_WS,
    divisionId: 'Div3',
    departmentId: 'Dept9',
    metricKey: 'disk_headroom_pct',
    value: 74.3,
    recordedAt: RECORDED_AT,
    recordedBy: 'dept9-hzr52-body-ssh',
    mode: 'insert_if_absent',
    basis: {
      machine: 'HZR52',
      role: 'office-pc',
      free_gb: 353.4,
      used_gb: 122.5,
      method: 'ssh + Get-PSDrive C',
      note: 'Office PC sample only — not fleet min until ln01/ln02 refreshed',
      docs: [
        'DABOS/docs/reference/dept09-assets/hzr52-ssh-from-laptop.md',
        'DABOS/docs/reference/dept09-assets/hzr52-office-pc-desk-software.md',
      ],
    },
  });

  await sql`
    INSERT INTO role_runs (role_id, role_type, summary_json)
    VALUES (
      'Dept9',
      'department',
      ${JSON.stringify({
        ...ROLE_SUMMARY,
        workspace_id: HEADROOM_WS,
        metric_key: 'disk_headroom_pct',
        value: 74.3,
        recorded_at: RECORDED_AT,
      })}::jsonb
    )
  `;

  try {
    await sql`
      UPDATE department_establishment SET
        stat_status = 'reported',
        stat_metric_key = 'disk_headroom_pct',
        checked_at = ${DAY},
        updated_at = NOW()
      WHERE department_id = 'Dept9'
    `;
  } catch {
    console.log('(department_establishment update skipped)');
  }

  console.log(
    headroom.inserted
      ? `${HEADROOM_WS}: inserted disk_headroom_pct=74.3`
      : `${HEADROOM_WS}: disk_headroom_pct already present (idempotent)`
  );
  console.log('role_runs: Dept9 body HZR52 receipt logged');

  if ('end' in sql && typeof sql.end === 'function') {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
