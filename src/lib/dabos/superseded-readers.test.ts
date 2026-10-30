// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DabosSql } from '@/lib/dabos/dabos-connection';
import { createDabosTestDb, pgliteSql } from '@/test/pglite-dabos';

/** Readers skip superseded stats/conditions rows; the latest non-superseded row wins. Made-up data. */

let sqlRef: DabosSql | null = null;
vi.mock('@/lib/dabos/db', () => ({
  getDabosSql: vi.fn(() => sqlRef),
  hasDabosDb: vi.fn(() => true),
}));

import { evaluateBoardConditionsWithSql } from '@/lib/dabos/board-conditions-query';
import { getLatestCondition, getLatestStatValue } from '@/lib/dabos/queries';
import { runStatCrawl } from '@/lib/dabos/stat-crawl';

const SUPERSEDED = `now()`;

async function seedOrg(db: PGlite) {
  await db.exec(`
    INSERT INTO divisions (id, operational_name, primary_metric_key) VALUES
      ('Div2', 'Div2', 'leads_or_touchpoints_created'),
      ('Div4', 'Div4', 'shipped_outputs'),
      ('Div5', 'Div5', 'qa_pass_rate'),
      ('Div7', 'Div7', 'plan_completion_rate');
    INSERT INTO departments (id, division_id, legacy_name, operational_name) VALUES
      ('Dept12', 'Div4', 'x', 'x');
  `);
}

async function addStat(
  db: PGlite,
  row: { div: string; dept?: string | null; metric: string; value: number; at: string; superseded?: boolean; basis?: object }
) {
  await db.query(
    `INSERT INTO stats (workspace_id, division_id, department_id, metric_key, value, recorded_at, basis, superseded_at, superseded_reason)
     VALUES ('test-ws', $1, $2, $3, $4, $5, $6, ${row.superseded ? SUPERSEDED : 'NULL'}, ${row.superseded ? `'test'` : 'NULL'})`,
    [row.div, row.dept ?? null, row.metric, row.value, row.at, row.basis ? JSON.stringify(row.basis) : null]
  );
}

describe('readers skip superseded rows', () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await createDabosTestDb();
    await seedOrg(db);
    sqlRef = pgliteSql(db);
  });
  afterEach(async () => {
    sqlRef = null;
    await db.close();
  });

  it('board: superseded W44 row is excluded and the latest non-superseded W44 row wins', async () => {
    for (const [at, v] of [
      ['2026-10-08T10:00:00Z', 3],
      ['2026-10-15T10:00:00Z', 4],
      ['2026-10-22T10:00:00Z', 5],
      ['2026-10-27T10:00:00Z', 1], // W44, older non-superseded
      ['2026-10-29T12:59:59.999Z', 6], // W44, latest non-superseded (the correction)
    ] as const) {
      await addStat(db, { div: 'Div4', metric: 'shipped_outputs', value: v, at });
    }
    // W44 poster-style row: latest of all in W44 (in any server TZ), but superseded.
    await addStat(db, { div: 'Div4', metric: 'shipped_outputs', value: 2, at: '2026-10-30T10:00:00Z', superseded: true });

    const board = await evaluateBoardConditionsWithSql(sqlRef!, { year: 2026, calendarWeek: 44 });
    expect(board.divisionStats.get('Div4')).toMatchObject({ value: 6, calendar_week: 44, point_count: 4 });
    expect(board.divisionCharts.get('Div4')).toBeDefined();
  });

  it('board: a week with only superseded rows has no point', async () => {
    await addStat(db, { div: 'Div7', metric: 'plan_completion_rate', value: 50, at: '2026-10-22T10:00:00Z' });
    await addStat(db, { div: 'Div7', metric: 'plan_completion_rate', value: 28.6, at: '2026-10-30T10:00:00Z', superseded: true });
    const board = await evaluateBoardConditionsWithSql(sqlRef!, { year: 2026, calendarWeek: 44 });
    expect(board.divisionStats.get('Div7')).toMatchObject({ value: 50, calendar_week: 43, point_count: 1 });
  });

  it('stat crawl: superseded-only primaries are missing; latest non-superseded wins', async () => {
    const now = new Date('2026-10-29T14:00:00Z'); // Thu 15:00 Berlin, ISO week 44
    // Div2: only a superseded 0 without basis -> missing_emit (not zero_without_basis).
    await addStat(db, { div: 'Div2', metric: 'leads_or_touchpoints_created', value: 0, at: '2026-10-28T10:00:00Z', superseded: true });
    // Div4: non-superseded correction present -> not missing.
    await addStat(db, { div: 'Div4', metric: 'shipped_outputs', value: 6, at: '2026-10-29T12:59:59.999Z', basis: { source: 'x' } });
    // Div5: newer superseded 0 without basis must not shadow the older valid value.
    await addStat(db, { div: 'Div5', metric: 'qa_pass_rate', value: 80, at: '2026-10-27T10:00:00Z' });
    await addStat(db, { div: 'Div5', metric: 'qa_pass_rate', value: 0, at: '2026-10-29T12:00:00Z', superseded: true });
    // Div7: newest non-superseded is 0 without basis -> zero_without_basis (older 50 ignored).
    await addStat(db, { div: 'Div7', metric: 'plan_completion_rate', value: 50, at: '2026-10-27T10:00:00Z' });
    await addStat(db, { div: 'Div7', metric: 'plan_completion_rate', value: 0, at: '2026-10-28T10:00:00Z' });

    await db.exec(`INSERT INTO divisions (id, operational_name) VALUES ('Div1', 'Div1') ON CONFLICT DO NOTHING;
                   INSERT INTO departments (id, division_id, legacy_name, operational_name) VALUES ('Dept3','Div1','x','x') ON CONFLICT DO NOTHING;`);

    const res = await runStatCrawl({ dabosSql: sqlRef!, now });
    expect(res.iso_week).toBe(44);
    expect(res.missing).toEqual([
      { division_id: 'Div2', metric_key: 'leads_or_touchpoints_created', reason: 'missing_emit' },
      { division_id: 'Div7', metric_key: 'plan_completion_rate', reason: 'zero_without_basis' },
    ]);
  });

  it('queries: latest stat value and latest condition skip superseded rows', async () => {
    await addStat(db, { div: 'Div4', metric: 'shipped_outputs', value: 6, at: '2026-10-29T12:59:59.999Z' });
    await addStat(db, { div: 'Div4', metric: 'shipped_outputs', value: 2, at: '2026-11-01T23:59:59.999Z', superseded: true });
    expect(await getLatestStatValue('Div4', 'shipped_outputs')).toMatchObject({ value: 6 });

    await db.exec(`
      INSERT INTO conditions (entity_type, entity_id, condition, created_at) VALUES
        ('division', 'Div4', 'Normal', '2026-10-22T13:00:00Z'),
        ('division', 'Div4', 'Emergency', '2026-10-28T13:00:00Z');
      INSERT INTO conditions (entity_type, entity_id, condition, created_at, superseded_at, superseded_reason) VALUES
        ('division', 'Div4', 'Danger', '2026-10-29T13:30:13Z', now(), 'test');
    `);
    expect(await getLatestCondition('division', 'Div4')).toMatchObject({ condition: 'Emergency' });
  });
});
