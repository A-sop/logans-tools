// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { afterEach, describe, expect, it } from 'vitest';

import { readRepoFile } from '@/test/pglite-dabos';

async function setup(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(readRepoFile('migrations/001_create_tables.sql'));
  await db.exec(readRepoFile('migrations/002_seed_org.sql'));
  await db.exec(readRepoFile('migrations/018_task_ingest_basket.sql'));
  // Prod carries status=reassess; allow it for the rebasket test only.
  await db.exec(`
    ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
    ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
      CHECK (status IN ('todo', 'doing', 'blocked', 'done', 'cancelled', 'reassess'));
  `);
  // Lower-case division variant (prod has a div4 row).
  await db.exec(`INSERT INTO divisions (id, operational_name) VALUES ('div4', 'Technical (legacy case)')
    ON CONFLICT DO NOTHING`);
  return db;
}

function extractCourierSql(): string {
  const courier = readRepoFile('ops/ln02/comm-center/courier.sh');
  const sqlStart = courier.indexOf("COURIER_SQL=\"$(cat <<'SQL'");
  const sqlBodyStart = courier.indexOf('\n', sqlStart) + 1;
  const sqlBodyEnd = courier.indexOf('\nSQL\n', sqlBodyStart);
  return courier.slice(sqlBodyStart, sqlBodyEnd);
}

describe('comm-center SQL (PGlite)', { timeout: 60_000 }, () => {
  let db: PGlite | null = null;
  afterEach(async () => {
    if (db) await db.close();
    db = null;
  });

  it('normalises div4 and aborts on unmapped agent', async () => {
    db = await setup();
    await db.exec(`
      INSERT INTO tasks (division_id, department_id, title, status, basket, assigned_agent)
      VALUES ('div4', 'Dept12', 'x', 'todo', 'in', 'research');
    `);
    await db.exec(readRepoFile('scripts/dabos/sql/2026-11-01_comm_center_normalise_addressees.sql'));
    const r = await db.query<{ division_id: string }>(
      `SELECT division_id FROM tasks WHERE title = 'x'`
    );
    expect(r.rows[0]?.division_id).toBe('Div4');

    await db.exec(`UPDATE tasks SET assigned_agent = 'mystery-bot' WHERE title = 'x'`);
    await expect(
      db.exec(readRepoFile('scripts/dabos/sql/2026-11-01_comm_center_normalise_addressees.sql'))
    ).rejects.toThrow(/unmapped assigned_agent/);
  });

  it('normalises prod agent aliases (dept03 / Technical Secretary / DIV VI PUBLIC)', async () => {
    db = await setup();
    await db.exec(`
      INSERT INTO tasks (division_id, department_id, title, status, basket, assigned_agent) VALUES
        ('Div3', 'Dept9', 'p-stats', 'todo', 'in', 'dept03-perception-stats'),
        ('Div4', 'Dept12', 'tech-sec', 'todo', 'in', 'Div4 Technical Secretary'),
        ('Div6', 'Dept16', 'vi-public', 'todo', 'in', 'DIV VI PUBLIC');
    `);
    await db.exec(readRepoFile('scripts/dabos/sql/2026-11-01_comm_center_normalise_addressees.sql'));
    const rows = await db.query<{
      title: string;
      assigned_agent: string;
      division_id: string;
      department_id: string;
    }>(`SELECT title, assigned_agent, division_id, department_id FROM tasks ORDER BY title`);
    const by = Object.fromEntries(rows.rows.map((r) => [r.title, r]));
    expect(by['p-stats']?.assigned_agent).toBe('Div1');
    expect(by['p-stats']?.division_id).toBe('Div1');
    expect(by['p-stats']?.department_id).toBe('Dept3');
    expect(by['tech-sec']?.assigned_agent).toBe('Div4');
    expect(by['vi-public']?.assigned_agent).toBe('Div6');
  });

  it('rebaskets done→out, reassess→pending with stamps', async () => {
    db = await setup();
    await db.exec(`
      INSERT INTO tasks (division_id, department_id, title, status, basket) VALUES
        ('Div1', 'Dept1', 'done-row', 'done', 'in'),
        ('Div1', 'Dept1', 'todo-row', 'todo', 'in'),
        ('Div1', 'Dept1', 'reassess-row', 'reassess', 'in');
    `);
    await db.exec(readRepoFile('scripts/dabos/sql/2026-11-01_comm_center_rebasket.sql'));
    const rows = await db.query<{ title: string; basket: string; ingest_meta: unknown }>(
      `SELECT title, basket, ingest_meta FROM tasks ORDER BY title`
    );
    const by = Object.fromEntries(rows.rows.map((r) => [r.title, r]));
    expect(by['done-row']?.basket).toBe('out');
    expect(JSON.stringify(by['done-row']?.ingest_meta)).toContain('filed_at');
    expect(by['todo-row']?.basket).toBe('in');
    expect(by['reassess-row']?.basket).toBe('pending');
    const pending = (by['reassess-row']?.ingest_meta as { pending: { reason: string; waiting_on: { post: string } } })
      .pending;
    expect(pending.reason).toBe('reassess');
    expect(pending.waiting_on.post).toBe('Div1/Dept1');
  });

  it('aborts rebasket on unmapped status', async () => {
    db = await setup();
    await db.exec(`
      INSERT INTO tasks (division_id, department_id, title, status, basket)
      VALUES ('Div1', 'Dept1', 'doing-row', 'doing', 'in');
    `);
    await expect(
      db.exec(readRepoFile('scripts/dabos/sql/2026-11-01_comm_center_rebasket.sql'))
    ).rejects.toThrow(/unmapped status/);
  });

  it('creates v_comm_station with expected columns', async () => {
    db = await setup();
    await db.exec(`
      INSERT INTO tasks (division_id, department_id, title, status, basket, assigned_agent, ingest_meta)
      VALUES
        ('Div4', 'Dept12', 'in1', 'todo', 'in', NULL, '{}'),
        ('Div4', 'Dept12', 'pend1', 'todo', 'pending', NULL,
          '{"pending":{"reason":"wait","waiting_on":{"kind":"post","post":"Div1"},"since":"2026-10-01T00:00:00Z"}}'::jsonb),
        ('Div4', 'Dept12', 'out1', 'done', 'out', NULL, '{}'),
        ('Div1', 'Dept21', 'ldw1', 'todo', 'in', 'LDW', '{}');
    `);
    await db.exec(readRepoFile('scripts/dabos/sql/2026-11-01_v_comm_station.sql'));
    const r = await db.query<Record<string, unknown>>(
      `SELECT post, in_count, pending_count, out_count, never_reviewed_count
         FROM v_comm_station WHERE post IN ('Div4','LDW') ORDER BY post`
    );
    const div4 = r.rows.find((x) => x.post === 'Div4')!;
    const ldw = r.rows.find((x) => x.post === 'LDW')!;
    expect(Number(div4.in_count)).toBe(1);
    expect(Number(div4.pending_count)).toBe(1);
    expect(Number(div4.out_count)).toBe(1);
    expect(Number(div4.never_reviewed_count)).toBe(1);
    expect(Number(ldw.in_count)).toBe(1);
  });

  it('pending index create + undo', async () => {
    db = await setup();
    await db.exec(readRepoFile('scripts/dabos/sql/2026-11-01_comm_center_pending_index.sql'));
    const idx = await db.query(
      `SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tasks_pending_division'`
    );
    expect(idx.rows.length).toBe(1);
    await db.exec(readRepoFile('scripts/dabos/sql/2026-11-01_comm_center_pending_index.UNDO.sql'));
    const gone = await db.query(
      `SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tasks_pending_division'`
    );
    expect(gone.rows.length).toBe(0);
  });

  it('routing never sets basket=pending (courier OUT→recipient IN; Amendment 1)', async () => {
    // CHAT-DRAIN L23 "pending when routed" must not be carried over.
    const courier = readRepoFile('ops/ln02/comm-center/courier.sh');
    const routeStart = courier.indexOf('-- 3) Route OUT');
    const routeEnd = courier.indexOf('-- 4) P2:');
    expect(routeStart).toBeGreaterThan(-1);
    expect(routeEnd).toBeGreaterThan(routeStart);
    const routeBlock = courier.slice(routeStart, routeEnd);
    expect(routeBlock).toMatch(/SET basket = 'in'/);
    expect(routeBlock).not.toMatch(/basket\s*=\s*'pending'/);

    const courierSql = extractCourierSql();

    db = await setup();
    // Sender writes OUT; courier delivers to recipient IN (never PENDING).
    await db.exec(`
      INSERT INTO tasks (division_id, department_id, title, status, basket, ingest_meta)
      VALUES
        ('Div1', 'Dept2', 'despatch-to-div4', 'todo', 'out',
          '{"from":"Div1","to":"Div4"}'::jsonb),
        ('Div4', 'Dept12', 'despatch-to-div1', 'todo', 'out',
          '{"from":"Div4","to":"Div1"}'::jsonb);
    `);
    await db.exec(courierSql);
    const rows = await db.query<{
      title: string;
      basket: string;
      division_id: string;
      ingest_meta: { to?: string; routed_at?: string; routed_from?: string };
    }>(`SELECT title, basket, division_id, ingest_meta FROM tasks WHERE title LIKE 'despatch-%' ORDER BY title`);
    const by = Object.fromEntries(rows.rows.map((r) => [r.title, r]));
    expect(by['despatch-to-div4']?.basket).toBe('in');
    expect(by['despatch-to-div4']?.division_id).toBe('Div4');
    expect(by['despatch-to-div4']?.ingest_meta?.to).toBeUndefined();
    expect(by['despatch-to-div4']?.ingest_meta?.routed_from).toBe('Div4');
    expect(by['despatch-to-div4']?.ingest_meta?.routed_at).toBeTruthy();
    expect(by['despatch-to-div1']?.basket).toBe('in');
    expect(by['despatch-to-div1']?.division_id).toBe('Div1');
    expect(rows.rows.every((r) => r.basket !== 'pending')).toBe(true);
  });

  it('routing round trip: hat-receipt OUT does not re-deliver (Amendment 2)', async () => {
    const courierSql = extractCourierSql();
    db = await setup();
    await db.exec(`
      INSERT INTO tasks (division_id, department_id, title, status, basket, assigned_agent, ingest_meta)
      VALUES ('Div1', 'Dept2', 'round-trip', 'todo', 'out', 'Div1',
        '{"from":"Div1","to":"Div4"}'::jsonb);
    `);
    await db.exec(courierSql);
    let row = await db.query<{
      basket: string;
      division_id: string;
      assigned_agent: string | null;
      ingest_meta: { to?: string; routed_at?: string; filed_at?: string };
    }>(`SELECT basket, division_id, assigned_agent, ingest_meta FROM tasks WHERE title = 'round-trip'`);
    expect(row.rows[0]?.basket).toBe('in');
    expect(row.rows[0]?.division_id).toBe('Div4');
    expect(row.rows[0]?.ingest_meta?.to).toBeUndefined();

    // Hat receipt: recipient finishes → OUT, meta unchanged (no new to).
    await db.exec(`UPDATE tasks SET basket = 'out', updated_at = NOW() WHERE title = 'round-trip'`);
    await db.exec(courierSql);
    row = await db.query<{
      basket: string;
      division_id: string;
      ingest_meta: { to?: string; filed_at?: string; routed_at?: string };
    }>(`SELECT basket, division_id, ingest_meta FROM tasks WHERE title = 'round-trip'`);
    // Filed (no to), still OUT — not bounced back to IN.
    expect(row.rows[0]?.basket).toBe('out');
    expect(row.rows[0]?.ingest_meta?.filed_at).toBeTruthy();
    expect(row.rows[0]?.ingest_meta?.to).toBeUndefined();

    // Another courier pass must not revive it.
    await db.exec(courierSql);
    row = await db.query<{ basket: string; division_id: string }>(
      `SELECT basket, division_id FROM tasks WHERE title = 'round-trip'`
    );
    expect(row.rows[0]?.basket).toBe('out');
    expect(row.rows[0]?.division_id).toBe('Div4');
  });

  it('excludes filed_at / done OUT from re-delivery (Amendment 2)', async () => {
    const courierSql = extractCourierSql();
    db = await setup();
    await db.exec(`
      INSERT INTO tasks (division_id, department_id, title, status, basket, ingest_meta) VALUES
        ('Div1', 'Dept1', 'already-filed', 'todo', 'out',
          '{"to":"Div4","filed_at":"2026-10-01T00:00:00Z"}'::jsonb),
        ('Div1', 'Dept1', 'done-with-to', 'done', 'out',
          '{"to":"Div4"}'::jsonb);
    `);
    await db.exec(courierSql);
    const rows = await db.query<{ title: string; basket: string; division_id: string; ingest_meta: unknown }>(
      `SELECT title, basket, division_id, ingest_meta FROM tasks WHERE title IN ('already-filed','done-with-to') ORDER BY title`
    );
    const by = Object.fromEntries(rows.rows.map((r) => [r.title, r]));
    expect(by['already-filed']?.basket).toBe('out');
    expect(by['already-filed']?.division_id).toBe('Div1');
    expect(by['done-with-to']?.basket).toBe('out');
    expect(by['done-with-to']?.division_id).toBe('Div1');
    expect(JSON.stringify(by['done-with-to']?.ingest_meta)).toContain('filed_at');
  });
});
