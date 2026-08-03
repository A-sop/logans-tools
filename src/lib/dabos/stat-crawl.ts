/**
 * Dept3 Perception crawl — after Good Thursday, flag missing division primaries.
 * Opens Neon tasks (Div1 / Dept3) + role_runs receipt. Does not invent values.
 */
import { getISOWeek, getISOWeekYear } from 'date-fns';

import type { DabosSql } from '@/lib/dabos/dabos-connection';
import { orgWeekLabel, weekBoundaryStart } from '@/lib/dabos/org-week';

export type MissingPrimary = {
  division_id: string;
  metric_key: string;
  reason: 'missing_emit' | 'zero_without_basis';
};

export type StatCrawlResult = {
  org_week: string;
  iso_year: number;
  iso_week: number;
  missing: MissingPrimary[];
  tasks_created: string[];
  reported_pct: number;
};

export async function runStatCrawl(opts: {
  dabosSql: DabosSql;
  now?: Date;
}): Promise<StatCrawlResult> {
  const now = opts.now ?? new Date();
  const sql = opts.dabosSql;
  const weekStart = weekBoundaryStart(now);
  const isoYear = getISOWeekYear(now);
  const isoWeek = getISOWeek(now);
  const orgWeek = orgWeekLabel(weekStart);

  const divisions = (await sql`
    SELECT id, primary_metric_key
    FROM divisions
    WHERE primary_metric_key IS NOT NULL
    ORDER BY id
  `) as Array<{ id: string; primary_metric_key: string }>;

  const missing: MissingPrimary[] = [];
  const tasksCreated: string[] = [];

  for (const div of divisions) {
    const metric = div.primary_metric_key;
    const rows = await sql`
      SELECT value::float8 AS value, workspace_id, basis, recorded_at
      FROM stats
      WHERE division_id = ${div.id}
        AND department_id IS NULL
        AND metric_key = ${metric}
        AND EXTRACT(ISOYEAR FROM recorded_at AT TIME ZONE 'Europe/Berlin') = ${isoYear}
        AND EXTRACT(WEEK FROM recorded_at AT TIME ZONE 'Europe/Berlin') = ${isoWeek}
      ORDER BY recorded_at DESC
      LIMIT 5
    `;

    if (!rows[0]) {
      // Div3 primary is monthly (Proviso Abrechnung), not weekly — skip Missing for ISO week silence
      if (div.id === 'Div3' && metric === 'taxable_income_eur') {
        const monthRows = await sql`
          SELECT value::float8 AS value, workspace_id
          FROM stats
          WHERE division_id = 'Div3'
            AND department_id IS NULL
            AND metric_key = 'taxable_income_eur'
            AND workspace_id LIKE 'proviso-%'
          ORDER BY recorded_at DESC
          LIMIT 1
        `;
        if (monthRows[0]) continue;
      }
      missing.push({
        division_id: div.id,
        metric_key: metric,
        reason: 'missing_emit',
      });
      continue;
    }

    const value = Number(rows[0].value);
    const basis = rows[0].basis;
    const workspaceId = String(rows[0].workspace_id ?? '');
    const hasLineage =
      basis != null && basis !== ''
        ? true
        : /^(div-live-|gfp-live-|proviso-|ship-gate-|hat-corr-)/.test(workspaceId);
    if (value === 0 && !hasLineage) {
      missing.push({
        division_id: div.id,
        metric_key: metric,
        reason: 'zero_without_basis',
      });
    }
  }

  for (const m of missing) {
    const title =
      m.reason === 'missing_emit'
        ? `[Dept3 crawl] Missing ${m.division_id} primary ${m.metric_key} for ${orgWeek}`
        : `[Dept3 crawl] ${m.division_id} ${m.metric_key}=0 without basis (${orgWeek})`;

    const existing = await sql`
      SELECT id FROM tasks
      WHERE division_id = 'Div1'
        AND department_id = 'Dept3'
        AND status IN ('todo', 'doing', 'blocked')
        AND title = ${title}
      LIMIT 1
    `;
    if (existing[0]) continue;

    const created = await sql`
      INSERT INTO tasks (
        workspace_id, division_id, department_id, title, description,
        type, status, priority, assigned_agent
      ) VALUES (
        ${`stat-crawl-${isoYear}-W${String(isoWeek).padStart(2, '0')}`},
        'Div1',
        'Dept3',
        ${title},
        ${`Non-reporting without recorded reason is an offense (STAT-MAP / ideal Layer E). Open reason or emit via week-close / ship-gate.`},
        'agent',
        'todo',
        2,
        'dept03-perception-stats'
      )
      RETURNING id
    `;
    if (created[0]?.id) tasksCreated.push(String(created[0].id));
  }

  const reported = divisions.length - missing.filter((m) => m.reason === 'missing_emit').length;
  const reportedPct =
    divisions.length === 0 ? 0 : Math.round((reported / divisions.length) * 1000) / 10;

  try {
    await sql`
      INSERT INTO role_runs (role_id, role_type, summary_json)
      VALUES (
        'stat_crawl',
        'cadence',
        ${JSON.stringify({
          org_week: orgWeek,
          iso_year: isoYear,
          iso_week: isoWeek,
          missing,
          tasks_created: tasksCreated,
          reported_pct: reportedPct,
          division_count: divisions.length,
        })}::jsonb
      )
    `;
  } catch {
    /* role_runs optional */
  }

  return {
    org_week: orgWeek,
    iso_year: isoYear,
    iso_week: isoWeek,
    missing,
    tasks_created: tasksCreated,
    reported_pct: reportedPct,
  };
}
