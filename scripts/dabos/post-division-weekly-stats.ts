/**
 * Post Div1/2/3/4/5/7 primary stats from local registers, the DABOS wiki index + Proviso Abrechnung.
 * Run: npm run dabos:post-division-weekly-stats [--week=2026-W30] [--only=Div1]
 * --only=DivN[,DivM] posts only those divisions (e.g. a Logan-approved one-off Div1 backfill);
 * Proviso (Div3) is not read unless Div3 is listed.
 *
 * Content factory metrics live under Div2 (not Div6). Div6 stays GFP poster.
 */
import { createDabosSql } from '../../src/lib/dabos/dabos-connection';
import { postDivisionWeeklyStats } from '../../src/lib/dabos/division-weekly-stats';
import {
  closedOrgWeek,
  closedOrgWeekForIsoWeek,
  type ClosedOrgWeek,
} from '../../src/lib/dabos/org-week-window';
import { requireDatabaseUrl } from './load-env';

/**
 * --week=YYYY-Www = the org week closing on that ISO week's Thursday 14:00 Berlin.
 * A malformed or non-existent week is an error (never silently falls back to the current week).
 */
function parseWeekArg(): ClosedOrgWeek {
  const args = process.argv.filter((a) => a === '--week' || a.startsWith('--week='));
  if (args.length === 0) return closedOrgWeek();
  if (args.length > 1) throw new Error('--week given more than once');
  const raw = args[0]!.slice('--week='.length);
  const m = /^(\d{4})-W(\d{2})$/.exec(raw);
  if (!m) throw new Error(`Invalid --week '${raw}': expected YYYY-Www, e.g. --week=2026-W44`);
  const year = Number(m[1]);
  const week = Number(m[2]);
  const w = week >= 1 && week <= 53 ? closedOrgWeekForIsoWeek(year, week) : null;
  if (!w || w.isoYear !== year || w.isoWeek !== week) {
    throw new Error(`Invalid --week '${raw}': ISO week ${week} does not exist in ${year}`);
  }
  return w;
}

/** --only=Div1[,Div2] -> ['Div1', 'Div2']; absent -> undefined (all divisions). */
function parseOnlyArg(): string[] | undefined {
  const args = process.argv.filter((a) => a === '--only' || a.startsWith('--only='));
  if (args.length === 0) return undefined;
  if (args.length > 1) throw new Error('--only given more than once');
  const list = args[0]!.slice('--only='.length).split(',').map((s) => s.trim()).filter(Boolean);
  if (list.length === 0 || !list.every((d) => /^Div[1-7]$/.test(d))) {
    throw new Error(`Invalid --only '${args[0]}': expected e.g. --only=Div1 or --only=Div1,Div4`);
  }
  return list;
}

async function main() {
  const window = parseWeekArg();
  const only = parseOnlyArg();
  const dabosSql = createDabosSql(requireDatabaseUrl());

  const result = await postDivisionWeeklyStats({
    dabosSql,
    window,
    includeProvisoMonths: 12,
    only,
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
