/**
 * Re-evaluate PRD-004 conditions from YTD weekly stats and persist to Neon/Postgres.
 * Run: npm run dabos:refresh-conditions
 */
import fs from 'fs';
import path from 'path';

import { refreshAllConditionsFromBoardWithSql } from '../../src/lib/dabos/board-conditions-query';
import { createDabosSql } from '../../src/lib/dabos/dabos-connection';

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

  const sql = createDabosSql(url);
  const result = await refreshAllConditionsFromBoardWithSql(sql);

  console.log(`Week: ${result.week.label}`);
  console.log(
    `Persisted ${result.persisted.divisions} division + ${result.persisted.departments} department conditions`
  );
  for (const row of result.samples) {
    console.log(`  ${row.entity_id}: ${row.condition}`);
  }

  if ('end' in sql && typeof sql.end === 'function') {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
