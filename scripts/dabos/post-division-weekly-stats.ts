/**
 * Post Div2/3/4/5/7 primary stats from local registers + Proviso Abrechnung.
 * Run: npm run dabos:post-division-weekly-stats [--week=2026-W30]
 *
 * Content factory metrics live under Div2 (not Div6). Div6 stays GFP poster.
 */
import { createDabosSql } from '../../src/lib/dabos/dabos-connection';
import { postDivisionWeeklyStats } from '../../src/lib/dabos/division-weekly-stats';
import { resolveGfpIsoWeek } from '../../src/lib/dabos/gfp-weekly-stats';
import { requireDatabaseUrl } from './load-env';

function parseWeekArg(): { year: number; week: number } {
  const arg = process.argv.find((a) => a.startsWith('--week='));
  if (arg) {
    const m = arg.slice(7).match(/^(\d{4})-W(\d{1,2})$/);
    if (m) return { year: Number(m[1]), week: Number(m[2]) };
  }
  return resolveGfpIsoWeek();
}

async function main() {
  const { year, week } = parseWeekArg();
  const dabosSql = createDabosSql(requireDatabaseUrl());

  const result = await postDivisionWeeklyStats({
    dabosSql,
    year,
    week,
    includeProvisoMonths: 12,
  });

  console.log(`${result.workspaceId} @ ${result.recordedAt}`);
  for (const note of result.notes) console.log(`  ${note}`);
  if (result.inserted.length === 0) {
    console.log('(idempotent: no new rows — already present or sources skipped)');
  } else {
    console.log(`inserted: ${result.inserted.join(', ')}`);
  }

  if ('end' in dabosSql && typeof dabosSql.end === 'function') {
    await dabosSql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
