/**
 * Live week-close stats reader (Neon public.stats).
 * Canonical: workspace_id = div-live-YYYY-Www AND superseded_at IS NULL.
 * GFP venture funnel: gfp-live-YYYY-Www. Div3 income: latest proviso-YYYY-MM (monthly).
 * Missing = no live row (never invent zeros). Real zero is a reported value.
 */
import type { DabosSql } from '@/lib/dabos/dabos-connection';
import {
  closedOrgWeek,
  closedOrgWeekForIsoWeek,
  formatStatWeekId,
  type OrgStatWeek,
} from '@/lib/dabos/org-week';

export const DIVISIONS = ['Div1', 'Div2', 'Div3', 'Div4', 'Div5', 'Div6', 'Div7'] as const;
export type DivisionId = (typeof DIVISIONS)[number];

/** Primary GDS expected on div-live for every division (founder 2026-11-05). */
export const DIV_LIVE_PRIMARY: Record<DivisionId, string> = {
  Div1: 'artifacts_indexed',
  Div2: 'leads_or_touchpoints_created',
  Div3: 'taxable_income_eur', // also monthly proviso-*; weekly div-live may be absent
  Div4: 'shipped_outputs',
  Div5: 'qa_pass_rate',
  Div6: 'conversions', // venture children may live on gfp-live / other venture workspaces
  Div7: 'plan_completion_rate',
};

export type LiveStatRow = {
  id: string;
  workspace_id: string;
  division_id: string;
  department_id: string | null;
  metric_key: string;
  value: number;
  recorded_at: string;
  recorded_by: string | null;
  basis: unknown;
};

export type PrimaryCoverage = {
  division_id: DivisionId;
  metric_key: string;
  status: 'reported' | 'missing';
  value: number | null;
  stats_id: string | null;
  workspace_id: string | null;
  note?: string;
};

export type WeekStatsLiveSnapshot = {
  weekId: string;
  divLiveWorkspace: string;
  gfpLiveWorkspace: string;
  week: { start: string; end: string; label: string };
  divLiveRows: LiveStatRow[];
  gfpLiveRows: LiveStatRow[];
  provisoLatest: LiveStatRow[];
  primaryCoverage: PrimaryCoverage[];
  missingPrimaries: DivisionId[];
};

function parseWeekArg(week?: string): OrgStatWeek {
  if (!week) return closedOrgWeek();
  const m = /^(\d{4})-W(\d{2})$/.exec(week.trim());
  if (!m) throw new Error(`Invalid week '${week}': expected YYYY-Www`);
  const year = Number(m[1]);
  const isoWeek = Number(m[2]);
  const w = closedOrgWeekForIsoWeek(year, isoWeek);
  if (w.isoYear !== year || w.isoWeek !== isoWeek) {
    throw new Error(`Invalid week '${week}': ISO week ${isoWeek} does not exist in ${year}`);
  }
  return w;
}

function mapRow(r: Record<string, unknown>): LiveStatRow {
  return {
    id: String(r.id),
    workspace_id: String(r.workspace_id),
    division_id: String(r.division_id),
    department_id: r.department_id == null ? null : String(r.department_id),
    metric_key: String(r.metric_key),
    value: Number(r.value),
    recorded_at: String(r.recorded_at),
    recorded_by: r.recorded_by == null ? null : String(r.recorded_by),
    basis: r.basis ?? null,
  };
}

export async function fetchLiveWorkspaceRows(
  sql: DabosSql,
  workspaceId: string
): Promise<LiveStatRow[]> {
  const rows = await sql`
    SELECT id, workspace_id, division_id, department_id, metric_key,
           value::float8 AS value, recorded_at::text AS recorded_at,
           recorded_by, basis
    FROM stats
    WHERE workspace_id = ${workspaceId}
      AND superseded_at IS NULL
    ORDER BY division_id, department_id NULLS FIRST, metric_key
  `;
  return (rows as Record<string, unknown>[]).map(mapRow);
}

/** Live Div3 taxable_income_eur rows on the latest proviso-YYYY-MM workspace. */
export async function fetchLatestProvisoIncome(sql: DabosSql): Promise<LiveStatRow[]> {
  const latest = await sql`
    SELECT workspace_id
    FROM stats
    WHERE division_id = 'Div3'
      AND metric_key = 'taxable_income_eur'
      AND workspace_id LIKE 'proviso-%'
      AND superseded_at IS NULL
    ORDER BY workspace_id DESC
    LIMIT 1
  `;
  const ws = (latest as { workspace_id: string }[])[0]?.workspace_id;
  if (!ws) return [];
  return fetchLiveWorkspaceRows(sql, ws).then((rows) =>
    rows.filter((r) => r.division_id === 'Div3' && r.metric_key === 'taxable_income_eur')
  );
}

function buildPrimaryCoverage(
  divLive: LiveStatRow[],
  proviso: LiveStatRow[]
): PrimaryCoverage[] {
  const out: PrimaryCoverage[] = [];
  for (const div of DIVISIONS) {
    const metric = DIV_LIVE_PRIMARY[div];
    const row = divLive.find(
      (r) => r.division_id === div && r.department_id == null && r.metric_key === metric
    );
    if (row) {
      out.push({
        division_id: div,
        metric_key: metric,
        status: 'reported',
        value: row.value,
        stats_id: row.id,
        workspace_id: row.workspace_id,
      });
      continue;
    }
    if (div === 'Div3') {
      const p = proviso.find((r) => r.department_id == null);
      if (p) {
        out.push({
          division_id: div,
          metric_key: metric,
          status: 'reported',
          value: p.value,
          stats_id: p.id,
          workspace_id: p.workspace_id,
          note: 'monthly proviso workspace (not div-live); income unit = month',
        });
        continue;
      }
    }
    out.push({
      division_id: div,
      metric_key: metric,
      status: 'missing',
      value: null,
      stats_id: null,
      workspace_id: null,
      note:
        div === 'Div5'
          ? 'no live row (to-report if zero Dept13 verdicts in window)'
          : div === 'Div6'
            ? 'div-live primary missing; check gfp-live / venture workspaces for children'
            : undefined,
    });
  }
  return out;
}

export async function readWeekStatsLive(
  sql: DabosSql,
  opts?: { week?: string }
): Promise<WeekStatsLiveSnapshot> {
  const week = parseWeekArg(opts?.week);
  const weekId = formatStatWeekId(week.isoYear, week.isoWeek);
  const divLiveWorkspace = `div-live-${weekId}`;
  const gfpLiveWorkspace = `gfp-live-${weekId}`;

  const [divLiveRows, gfpLiveRows, provisoLatest] = await Promise.all([
    fetchLiveWorkspaceRows(sql, divLiveWorkspace),
    fetchLiveWorkspaceRows(sql, gfpLiveWorkspace),
    fetchLatestProvisoIncome(sql),
  ]);

  const primaryCoverage = buildPrimaryCoverage(divLiveRows, provisoLatest);
  return {
    weekId,
    divLiveWorkspace,
    gfpLiveWorkspace,
    week: {
      start: week.start.toISOString(),
      end: week.end.toISOString(),
      label: week.label,
    },
    divLiveRows,
    gfpLiveRows,
    provisoLatest,
    primaryCoverage,
    missingPrimaries: primaryCoverage
      .filter((c) => c.status === 'missing')
      .map((c) => c.division_id),
  };
}

/** Markdown register body generated from Neon (archive only — Neon remains SSOT). */
export function formatWeekStatsRegisterMarkdown(snap: WeekStatsLiveSnapshot): string {
  const lines: string[] = [];
  lines.push(`# Stats register ${snap.weekId}`);
  lines.push('');
  lines.push(`**Source:** Neon \`public.stats\` live rows (generated; do not hand-edit as SSOT).`);
  lines.push(`**Window:** ${snap.week.label}`);
  lines.push(`**Workspaces:** \`${snap.divLiveWorkspace}\`, \`${snap.gfpLiveWorkspace}\`, plus latest \`proviso-*\` for Div3 income.`);
  lines.push(`**Rule:** \`superseded_at IS NULL\` only. Missing = no row. Reported \`0\` is a real zero.`);
  lines.push('');
  lines.push('## Primary coverage (div-live GDS + Div3 proviso fallback)');
  lines.push('');
  lines.push('| Division | Metric | Status | Value | Workspace | stats.id |');
  lines.push('|---|---|---|---|---|---|');
  for (const c of snap.primaryCoverage) {
    const val = c.status === 'reported' ? String(c.value) : '—';
    const ws = c.workspace_id ?? '—';
    const id = c.stats_id ?? '—';
    const note = c.note ? ` (${c.note})` : '';
    lines.push(
      `| ${c.division_id} | \`${c.metric_key}\` | **${c.status}**${note} | ${val} | \`${ws}\` | ${id} |`
    );
  }
  lines.push('');
  lines.push('## Live rows — div-live');
  lines.push('');
  if (snap.divLiveRows.length === 0) {
    lines.push('_No live rows._');
  } else {
    lines.push('| Division | Dept | Metric | Value | recorded_by | recorded_at | id |');
    lines.push('|---|---|---|---|---|---|---|');
    for (const r of snap.divLiveRows) {
      lines.push(
        `| ${r.division_id} | ${r.department_id ?? '—'} | \`${r.metric_key}\` | ${r.value} | ${r.recorded_by ?? '—'} | ${r.recorded_at} | ${r.id} |`
      );
    }
  }
  lines.push('');
  lines.push('## Live rows — gfp-live (Div6 venture funnel slice)');
  lines.push('');
  if (snap.gfpLiveRows.length === 0) {
    lines.push('_No live rows._');
  } else {
    lines.push('| Division | Dept | Metric | Value | recorded_by | id |');
    lines.push('|---|---|---|---|---|---|');
    for (const r of snap.gfpLiveRows) {
      lines.push(
        `| ${r.division_id} | ${r.department_id ?? '—'} | \`${r.metric_key}\` | ${r.value} | ${r.recorded_by ?? '—'} | ${r.id} |`
      );
    }
  }
  lines.push('');
  lines.push('## Div3 latest proviso income (monthly)');
  lines.push('');
  if (snap.provisoLatest.length === 0) {
    lines.push('_No proviso income rows._');
  } else {
    lines.push('| Workspace | Dept | Value | recorded_at | id |');
    lines.push('|---|---|---|---|---|');
    for (const r of snap.provisoLatest) {
      lines.push(
        `| \`${r.workspace_id}\` | ${r.department_id ?? '—'} | ${r.value} | ${r.recorded_at} | ${r.id} |`
      );
    }
  }
  lines.push('');
  lines.push('## Missing primaries');
  lines.push('');
  if (snap.missingPrimaries.length === 0) {
    lines.push('_None._');
  } else {
    lines.push(snap.missingPrimaries.map((d) => `- ${d}`).join('\n'));
  }
  lines.push('');
  return lines.join('\n');
}
