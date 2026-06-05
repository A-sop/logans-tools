/**
 * Seed weekly division + department stats YTD 2026 for org-board demo.
 * Run: npm run dabos:seed-stats
 */
import fs from 'fs';
import path from 'path';
import { endOfISOWeek, setISOWeek, startOfYear } from 'date-fns';
import postgres from 'postgres';

import { BOARD_STAT_YEAR, currentCalendarWeek } from '../../src/lib/dabos/calendar-week';

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=(.*)$/);
    if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

const YEAR = BOARD_STAT_YEAR;
const SEED_TAG = 'seed-ytd-2026';

const DIVISION_TRENDS: Record<
  string,
  { metric: string; base: number; weeklyDelta: number; noise: number }
> = {
  Div1: { metric: 'artifacts_indexed', base: 12, weeklyDelta: 2.5, noise: 1 },
  Div2: { metric: 'leads_or_touchpoints_created', base: 180, weeklyDelta: 0.2, noise: 8 },
  Div3: { metric: 'net_eur', base: 4200, weeklyDelta: -120, noise: 80 },
  Div4: { metric: 'shipped_outputs', base: 4, weeklyDelta: 0.6, noise: 0.3 },
  Div5: { metric: 'qa_pass_rate', base: 0.91, weeklyDelta: 0.001, noise: 0.008 },
  Div6: { metric: 'conversions', base: 72, weeklyDelta: -2.5, noise: 3 },
  Div7: { metric: 'plan_completion_rate', base: 0.62, weeklyDelta: 0.012, noise: 0.015 },
};

function weekEndIso(year: number, week: number): Date {
  const anchor = setISOWeek(startOfYear(new Date(year, 0, 4)), week);
  return endOfISOWeek(anchor);
}

function divisionValue(
  divisionId: string,
  spec: (typeof DIVISION_TRENDS)[string],
  week: number
): number {
  const trend = spec.base + spec.weeklyDelta * (week - 1);
  const jitter = (Math.sin(week * 1.7 + divisionId.charCodeAt(3)) * spec.noise) / 2;
  return Math.round((trend + jitter) * 100) / 100;
}

async function main() {
  loadEnvLocal();
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const sql = postgres(url, { max: 1 });
  const throughWeek = currentCalendarWeek(YEAR);

  const rangeStart = new Date(YEAR, 0, 1).toISOString();
  const rangeEnd = weekEndIso(YEAR, throughWeek).toISOString();

  await sql`
    DELETE FROM stats
    WHERE workspace_id = ${SEED_TAG}
      AND recorded_at >= ${rangeStart}::timestamptz
      AND recorded_at <= ${rangeEnd}::timestamptz
  `;

  const departments = await sql`
    SELECT id, division_id FROM departments ORDER BY id
  `;

  let inserted = 0;

  for (const [divisionId, spec] of Object.entries(DIVISION_TRENDS)) {
    for (let week = 1; week <= throughWeek; week += 1) {
      const value = divisionValue(divisionId, spec, week);
      const recordedAt = weekEndIso(YEAR, week);

      await sql`
        INSERT INTO stats (workspace_id, division_id, department_id, metric_key, value, recorded_at)
        VALUES (
          ${SEED_TAG},
          ${divisionId},
          NULL,
          ${spec.metric},
          ${value},
          ${recordedAt.toISOString()}::timestamptz
        )
      `;
      inserted += 1;
    }
  }

  const deptsByDiv = new Map<string, { id: string }[]>();
  for (const d of departments) {
    const divId = d.division_id as string;
    const list = deptsByDiv.get(divId) ?? [];
    list.push({ id: d.id as string });
    deptsByDiv.set(divId, list);
  }

  for (const [divisionId, spec] of Object.entries(DIVISION_TRENDS)) {
    const divDepts = deptsByDiv.get(divisionId) ?? [];
    for (let week = 1; week <= throughWeek; week += 1) {
      const divValue = divisionValue(divisionId, spec, week);
      const recordedAt = weekEndIso(YEAR, week);

      for (let i = 0; i < divDepts.length; i += 1) {
        const dept = divDepts[i]!;
        const deptFactor = 0.88 + i * 0.06;
        const deptNoise = (Math.sin(week * 2.1 + i) * spec.noise) / 4;
        const value = Math.round((divValue * deptFactor + deptNoise) * 100) / 100;

        await sql`
          INSERT INTO stats (workspace_id, division_id, department_id, metric_key, value, recorded_at)
          VALUES (
            ${SEED_TAG},
            ${divisionId},
            ${dept.id},
            ${spec.metric},
            ${value},
            ${recordedAt.toISOString()}::timestamptz
          )
        `;
        inserted += 1;
      }
    }
  }

  console.log(
    `Seeded ${inserted} weekly stats (${SEED_TAG}, CW1–${throughWeek} ${YEAR}, divisions + departments)`
  );
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
