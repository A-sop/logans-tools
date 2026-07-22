/**
 * Thursday week-close: GFP + division weekly posters + refresh conditions + role_run.
 * Run: npm run dabos:week-close
 */
import { refreshAllConditionsFromBoardWithSql } from '../../src/lib/dabos/board-conditions-query';
import { createDabosSql } from '../../src/lib/dabos/dabos-connection';
import { postDivisionWeeklyStats } from '../../src/lib/dabos/division-weekly-stats';
import {
  postGfpWeeklyStats,
  resolveGfpIsoWeek,
} from '../../src/lib/dabos/gfp-weekly-stats';
import {
  hoursUntilStatsDeadline,
  isPastStatsDeadline,
  orgWeekLabel,
  weekBoundaryStart,
} from '../../src/lib/dabos/org-week';
import { loadEnvLocal, requireDatabaseUrl } from './load-env';

async function main() {
  loadEnvLocal();
  const url = requireDatabaseUrl();

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

  const gfpUrl = process.env.GFP_DATABASE_URL?.trim() || url;
  const { year, week } = resolveGfpIsoWeek(now);
  let gfpPoster: Record<string, unknown> | null = null;
  try {
    const gfp = await postGfpWeeklyStats({
      dabosSql: sql,
      gfpDatabaseUrl: gfpUrl,
      year,
      week,
    });
    gfpPoster = {
      workspace_id: gfp.workspaceId,
      lead_magnets_shipped: gfp.leadMagnetsShipped,
      termin_clicks_booked_proxy: gfp.terminClicksBookedProxy,
      inserted: gfp.inserted,
      note: 'termin_clicks is Cal booked proxy until PostHog CTA ingest',
    };
    console.log(
      `\nGFP poster ${gfp.workspaceId}: magnets=${gfp.leadMagnetsShipped}, termin_clicks(booked_proxy)=${gfp.terminClicksBookedProxy}`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    gfpPoster = { error: message };
    console.log(`\nGFP poster skipped: ${message}`);
  }

  let divisionPoster: Record<string, unknown> | null = null;
  try {
    const div = await postDivisionWeeklyStats({
      dabosSql: sql,
      year,
      week,
      includeProvisoMonths: 12,
    });
    divisionPoster = {
      workspace_id: div.workspaceId,
      inserted: div.inserted,
      notes: div.notes,
    };
    console.log(`\nDivision poster ${div.workspaceId}: inserted=${div.inserted.length}`);
    for (const note of div.notes) console.log(`  ${note}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    divisionPoster = { error: message };
    console.log(`\nDivision poster skipped: ${message}`);
  }

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
        gfp_poster: gfpPoster,
        division_poster: divisionPoster,
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
