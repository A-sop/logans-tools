/**
 * Thursday week-close: refresh conditions + log role_run.
 * Run: npm run dabos:week-close
 */
import fs from 'fs';
import path from 'path';

import { refreshAllConditionsFromBoardWithSql } from '../../src/lib/dabos/board-conditions-query';
import { createDabosSql } from '../../src/lib/dabos/dabos-connection';
import {
  hoursUntilStatsDeadline,
  isPastStatsDeadline,
  orgWeekLabel,
  weekBoundaryStart,
} from '../../src/lib/dabos/org-week';

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=(.*)$/);
    if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

async function main() {
  loadEnvLocal();
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error('DATABASE_URL is required (.env.local)');
    process.exit(1);
  }

  const now = new Date();
  const weekStart = weekBoundaryStart(now);
  const label = orgWeekLabel(weekStart);
  const pastDeadline = isPastStatsDeadline(now);
  const hoursLeft = hoursUntilStatsDeadline(now);

  console.log(`# DABOS week close`);
  console.log(label);
  if (pastDeadline) {
    console.log('Stats deadline: PASSED (Thu 14:00 Berlin)');
  } else {
    console.log(`Stats deadline: ${hoursLeft.toFixed(1)}h until Thu 14:00 Berlin`);
  }

  const sql = createDabosSql(url);
  const result = await refreshAllConditionsFromBoardWithSql(sql);

  console.log(`\nConditions (${result.week.label}):`);
  console.log(
    `  Persisted ${result.persisted.divisions} division + ${result.persisted.departments} department`
  );
  for (const row of result.samples) {
    console.log(`  ${row.entity_id}: ${row.condition}`);
  }

  let ventures: Array<{
    venture_tag: string;
    label?: string;
    baseline_eur_monthly: number;
    target_eur_monthly: number;
    source_system: string;
  }> = [];
  try {
    ventures = (await sql`
      SELECT venture_tag, label, baseline_eur_monthly, target_eur_monthly, source_system
      FROM venture_income_targets
      ORDER BY venture_tag
    `) as typeof ventures;
  } catch {
    console.log('\n(venture_income_targets not migrated — run npm run dabos:migrate)');
  }
  if (ventures.length > 0) {
    console.log('\nVenture income targets:');
    for (const v of ventures) {
      console.log(
        `  ${v.venture_tag}: baseline €${v.baseline_eur_monthly} → target €${v.target_eur_monthly} (${v.source_system})`
      );
    }
  }

  await sql`
    INSERT INTO role_runs (role_id, role_type, summary_json)
    VALUES (
      'week_close',
      'cadence',
      ${JSON.stringify({
        org_week: label,
        past_stats_deadline: pastDeadline,
        conditions: result.samples,
        venture_count: ventures.length,
      })}::jsonb
    )
  `.catch(() => {
    console.log('(role_runs not migrated — run npm run dabos:migrate)');
  });

  console.log('\nLogged role_run: week_close');

  if ('end' in sql && typeof sql.end === 'function') {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
