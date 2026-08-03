/**
 * Thursday week-close: GFP + division weekly posters + refresh conditions +
 * Dept3 stat crawl + role_run.
 * Run on office PC (Good Thursday): npm run dabos:week-close
 * Soft rehearsal (other days / pre-Thu): DABOS_WEEK_CLOSE_SOFT=1 — same pipeline,
 * role_run week_close_soft; inserts stay idempotent.
 * Vercel cron runs cloud-safe GFP only (set by DABOS_WEEK_CLOSE_CLOUD_ONLY / VERCEL).
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
import { runStatCrawl } from '../../src/lib/dabos/stat-crawl';
import { loadEnvLocal, requireDatabaseUrl } from './load-env';

function cloudOnly(): boolean {
  if (process.env.DABOS_WEEK_CLOSE_CLOUD_ONLY === '1') return true;
  if (process.env.DABOS_WEEK_CLOSE_CLOUD_ONLY === '0') return false;
  return Boolean(process.env.VERCEL);
}

function softClose(): boolean {
  return process.env.DABOS_WEEK_CLOSE_SOFT === '1';
}

async function main() {
  loadEnvLocal();
  const url = requireDatabaseUrl();

  const now = new Date();
  const weekStart = weekBoundaryStart(now);
  const label = orgWeekLabel(weekStart);
  const pastDeadline = isPastStatsDeadline(now);
  const hoursLeft = hoursUntilStatsDeadline(now);
  const skipLocal = cloudOnly();
  const soft = softClose();

  console.log(soft ? `# DABOS week close (SOFT rehearsal)` : `# DABOS week close`);
  console.log(label);
  console.log(
    soft
      ? 'Mode: SOFT — full office pipeline; idempotent inserts; role_run=week_close_soft'
      : skipLocal
        ? 'Mode: cloud-only (GFP + conditions + crawl; local division poster skipped)'
        : 'Mode: full (office Good Thursday — DATA + Proviso + registers)'
  );
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
  if (skipLocal) {
    divisionPoster = {
      skipped: true,
      reason: 'cloud-only — run office npm run dabos:week-close for Div1–5/7 + Proviso',
    };
    console.log('\nDivision poster skipped (cloud-only mode)');
  } else {
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
  }

  const result = await refreshAllConditionsFromBoardWithSql(sql);

  console.log(`\nConditions (${result.week.label}):`);
  console.log(
    `  Persisted ${result.persisted.divisions} division + ${result.persisted.departments} department`
  );
  for (const row of result.samples) {
    console.log(`  ${row.entity_id}: ${row.condition}`);
  }

  let crawl: Record<string, unknown> | null = null;
  try {
    const c = await runStatCrawl({ dabosSql: sql, now });
    crawl = {
      missing: c.missing,
      tasks_created: c.tasks_created,
      reported_pct: c.reported_pct,
    };
    console.log(
      `\nDept3 crawl: reported=${c.reported_pct}% missing=${c.missing.length} tasks=${c.tasks_created.length}`
    );
    for (const m of c.missing) {
      console.log(`  ${m.division_id} ${m.metric_key}: ${m.reason}`);
    }
  } catch (err) {
    crawl = { error: err instanceof Error ? err.message : String(err) };
    console.log(`\nDept3 crawl skipped: ${crawl.error}`);
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

  const roleId = soft ? 'week_close_soft' : 'week_close';
  await sql`
    INSERT INTO role_runs (role_id, role_type, summary_json)
    VALUES (
      ${roleId},
      'cadence',
      ${JSON.stringify({
        soft,
        org_week: label,
        past_stats_deadline: pastDeadline,
        cloud_only: skipLocal,
        conditions: result.samples,
        venture_count: ventures.length,
        gfp_poster: gfpPoster,
        division_poster: divisionPoster,
        stat_crawl: crawl,
      })}::jsonb
    )
  `.catch(() => {
    console.log('(role_runs not migrated — run npm run dabos:migrate)');
  });

  console.log(`\nLogged role_run: ${roleId}`);

  if ('end' in sql && typeof sql.end === 'function') {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
