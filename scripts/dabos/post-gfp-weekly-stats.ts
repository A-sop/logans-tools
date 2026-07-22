/**
 * Post weekly GFP funnel stats into DABOS Neon `stats` (Dept16/17 + Div6 rollup).
 * Run: npm run dabos:post-gfp-weekly-stats [--week=2026-W28]
 * Requires DATABASE_URL; optional GFP_DATABASE_URL if campaign_leads is on another Neon DB.
 *
 * termin_clicks = Cal booked proxy until PostHog CTA ingest (see STAT-MAP).
 */
import { createDabosSql } from '../../src/lib/dabos/dabos-connection';
import {
  postGfpWeeklyStats,
  resolveGfpIsoWeek,
} from '../../src/lib/dabos/gfp-weekly-stats';
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
  const dabosUrl = requireDatabaseUrl();
  const gfpUrl = process.env.GFP_DATABASE_URL?.trim() || dabosUrl;
  const dabosSql = createDabosSql(dabosUrl);

  const result = await postGfpWeeklyStats({
    dabosSql,
    gfpDatabaseUrl: gfpUrl,
    year,
    week,
  });

  console.log(
    `${result.workspaceId}: lead_magnets_shipped=${result.leadMagnetsShipped}, termin_clicks(booked_proxy)=${result.terminClicksBookedProxy} @ ${result.recordedAt}`
  );
  if (result.inserted.length === 0) {
    console.log('(idempotent: rows already present for this workspace week)');
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
