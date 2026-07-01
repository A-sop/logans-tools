/**
 * Morning executive plan — conditions + open tasks (light, no LLM).
 * Run: npm run dabos:morning-plan
 */
import fs from 'fs';
import path from 'path';

import { createDabosSql } from '../../src/lib/dabos/dabos-connection';
import { hoursUntilStatsDeadline, orgWeekLabel, weekBoundaryStart } from '../../src/lib/dabos/org-week';

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

  const weekStart = weekBoundaryStart();
  console.log(`# DABOS morning plan`);
  console.log(orgWeekLabel(weekStart));
  console.log(`Stats due: Thu 16:00 Berlin (${hoursUntilStatsDeadline().toFixed(1)}h)\n`);

  const sql = createDabosSql(url);

  const conditions = await sql`
    SELECT DISTINCT ON (entity_id) entity_id, condition, created_at
    FROM conditions
    WHERE entity_type = 'division'
    ORDER BY entity_id, created_at DESC
  `;

  console.log('Division conditions:');
  for (const c of conditions) {
    console.log(`  ${c.entity_id}: ${c.condition}`);
  }

  const tasks = await sql`
    SELECT id, division_id, title, status, priority
    FROM tasks
    WHERE status IN ('todo', 'doing', 'blocked')
    ORDER BY priority ASC, created_at ASC
    LIMIT 15
  `;

  console.log(`\nOpen tasks (${tasks.length} shown):`);
  for (const t of tasks) {
    console.log(`  [${t.division_id}] P${t.priority} ${t.status}: ${t.title}`);
  }

  let ventures: Array<{
    venture_tag: string;
    baseline_eur_monthly: number;
    target_eur_monthly: number;
    source_system: string;
  }> = [];
  try {
    ventures = (await sql`
      SELECT venture_tag, baseline_eur_monthly, target_eur_monthly, source_system
      FROM venture_income_targets
      LIMIT 5
    `) as typeof ventures;
  } catch {
    /* table not migrated */
  }
  if (ventures.length > 0) {
    console.log('\nIncome ladder:');
    for (const v of ventures) {
      console.log(`  ${v.venture_tag}: €${v.baseline_eur_monthly} baseline → €${v.target_eur_monthly} target (${v.source_system})`);
    }
  }

  try {
    await sql`
      INSERT INTO role_runs (role_id, role_type, summary_json)
      VALUES (
        'morning_plan',
        'cadence',
        ${JSON.stringify({
          open_tasks: tasks.length,
          divisions_reported: conditions.length,
        })}::jsonb
      )
    `;
  } catch {
    /* role_runs not migrated */
  }

  if ('end' in sql && typeof sql.end === 'function') {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
