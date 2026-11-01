// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  berlinDay,
  buildOpenOrdersSection,
  classifyOpenOrders,
  readOpenOrders,
  routeStalledBuildOrders,
  writeFinishReceipt,
  writeStartReceipt,
  type BuildReceiptRow,
} from '@/lib/dabos/build-receipt';
import { buildDigest } from '@/lib/dabos/status-digest';
import { closedOrgWeek } from '@/lib/dabos/org-week';
import { pgliteSql, readRepoFile } from '@/test/pglite-dabos';

async function setup(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(readRepoFile('migrations/001_create_tables.sql'));
  await db.exec(readRepoFile('migrations/002_seed_org.sql'));
  await db.exec(readRepoFile('migrations/018_task_ingest_basket.sql'));
  return db;
}

describe('build-receipt start/finish/idempotence', { timeout: 60_000 }, () => {
  let db: PGlite;
  afterEach(async () => {
    await db.close();
  });

  it('writes start and finish OUT rows; second call is idempotent', async () => {
    db = await setup();
    const sql = pgliteSql(db);
    const start1 = await writeStartReceipt(sql, {
      orderId: 'ord-21',
      repo: 'A-sop/logans-tools',
      branch: 'div4/build-receipts',
      machine: 'HZR52',
      expectedFinish: '2026-11-01T22:30:00+01:00',
      prLinks: ['https://github.com/A-sop/logans-tools/pull/67'],
      startedAt: '2026-11-01T20:57:00Z',
    });
    expect(start1.wrote).toBe(true);
    expect(start1.externalId).toBe('ord-21:start');

    const start2 = await writeStartReceipt(sql, {
      orderId: 'ord-21',
      repo: 'A-sop/logans-tools',
      branch: 'div4/build-receipts',
      machine: 'HZR52',
      expectedFinish: '2026-11-01T22:30:00+01:00',
      startedAt: '2026-11-01T20:57:00Z',
    });
    expect(start2.wrote).toBe(false);

    const fin1 = await writeFinishReceipt(sql, {
      orderId: 'ord-21',
      status: 'done',
      finishedAt: '2026-11-01T21:10:00Z',
      prLinks: ['https://github.com/A-sop/logans-tools/pull/67'],
    });
    expect(fin1.wrote).toBe(true);
    expect(fin1.externalId).toBe('ord-21:finish');

    const fin2 = await writeFinishReceipt(sql, {
      orderId: 'ord-21',
      status: 'failed',
      finishedAt: '2026-11-01T21:11:00Z',
    });
    expect(fin2.wrote).toBe(false);

    const rows = await db.query<{ basket: string; ext: string; meta: unknown }>(
      `SELECT basket, ingest_external_id AS ext, ingest_meta AS meta FROM tasks
        WHERE ingest_source = 'build-receipt' ORDER BY ingest_external_id`
    );
    expect(rows.rows).toHaveLength(2);
    expect(rows.rows.every((r) => r.basket === 'out')).toBe(true);
    expect(rows.rows.every((r) => r.basket !== 'pending')).toBe(true);
    const byExt = Object.fromEntries(rows.rows.map((r) => [r.ext, r]));
    expect(byExt['ord-21:start']!.meta).toMatchObject({
      kind: 'build-receipt',
      phase: 'start',
      from: 'Div4',
    });
    expect(byExt['ord-21:finish']!.meta).toMatchObject({
      kind: 'build-receipt',
      phase: 'finish',
      status: 'done',
    });
  });
});

describe('open-order classification + digest lines', () => {
  const baseStart = (over: Partial<BuildReceiptRow> = {}): BuildReceiptRow => ({
    orderId: 'o1',
    phase: 'start',
    repo: 'A-sop/logans-tools',
    branch: 'div4/build-receipts',
    machine: 'HZR52',
    expectedFinish: '2026-11-01T21:00:00Z',
    startedAt: '2026-11-01T19:00:00Z',
    finishedAt: null,
    finishStatus: null,
    prLinks: [],
    createdAt: '2026-11-01T19:00:00Z',
    ...over,
  });

  it('classifies running, done (within 24h), stalled; drops after 24h', () => {
    const now = new Date('2026-11-01T21:30:00Z');
    const running = classifyOpenOrders(
      [baseStart({ orderId: 'run', expectedFinish: '2026-11-01T22:00:00Z' })],
      now
    );
    expect(running).toEqual([
      expect.objectContaining({ orderId: 'run', status: 'running', machine: 'HZR52' }),
    ]);

    const done = classifyOpenOrders(
      [
        baseStart({ orderId: 'done1' }),
        {
          ...baseStart({ orderId: 'done1', phase: 'finish' }),
          finishedAt: '2026-11-01T20:00:00Z',
          finishStatus: 'done',
          createdAt: '2026-11-01T20:00:00Z',
        },
      ],
      now
    );
    expect(done[0]?.status).toBe('done');

    const stalled = classifyOpenOrders(
      [baseStart({ orderId: 'stall', expectedFinish: '2026-11-01T20:00:00Z' })],
      now
    );
    expect(stalled[0]?.status).toBe('stalled');

    const closed = classifyOpenOrders(
      [
        baseStart({ orderId: 'old' }),
        {
          ...baseStart({ orderId: 'old', phase: 'finish' }),
          finishedAt: '2026-10-30T20:00:00Z',
          finishStatus: 'done',
          createdAt: '2026-10-30T20:00:00Z',
        },
      ],
      now
    );
    expect(closed).toEqual([]);
  });

  it('buildOpenOrdersSection and digest render running/done/stalled lines', () => {
    const now = new Date('2026-11-01T21:30:00Z');
    const orders = classifyOpenOrders(
      [
        baseStart({ orderId: 'a', expectedFinish: '2026-11-01T22:00:00Z' }),
        baseStart({ orderId: 'b', expectedFinish: '2026-11-01T20:00:00Z' }),
        baseStart({ orderId: 'c' }),
        {
          ...baseStart({ orderId: 'c', phase: 'finish' }),
          finishedAt: '2026-11-01T20:30:00Z',
          finishStatus: 'done',
          createdAt: '2026-11-01T20:30:00Z',
        },
      ],
      now
    );
    const section = buildOpenOrdersSection(orders);
    expect(section).toContain('## Open orders (3)');
    expect(section).toMatch(/running: a ·/);
    expect(section).toMatch(/stalled: b ·/);
    expect(section).toMatch(/done: c ·/);
    expect(section).toContain('Berlin');

    const digest = buildDigest({
      now,
      host: 'ln02',
      week: closedOrgWeek(now),
      prs: [],
      tasks: [],
      approvals: [],
      stats: null,
      cadence: [],
      systemd: null,
      checkoutSync: null,
      openOrders: orders,
      sourceErrors: [],
    });
    expect(digest.markdown).toContain('## Open orders (3)');
    expect(digest.markdown).toContain('stalled: b');
    expect(digest.json.openOrders?.map((o) => o.status).sort()).toEqual([
      'done',
      'running',
      'stalled',
    ]);
  });
});

describe('stall routing once per Berlin day', { timeout: 60_000 }, () => {
  let db: PGlite;
  afterEach(async () => {
    await db.close();
  });

  it('inserts Dept2 IN once; second same-day route is a no-op; never pending', async () => {
    db = await setup();
    const sql = pgliteSql(db);
    await writeStartReceipt(sql, {
      orderId: 'stall-9',
      repo: 'A-sop/logans-tools',
      branch: 'div4/build-receipts',
      machine: 'HZR52',
      expectedFinish: '2026-11-01T18:00:00Z',
      startedAt: '2026-11-01T17:00:00Z',
    });
    const now = new Date('2026-11-01T20:00:00Z');
    const open = await readOpenOrders(sql, now);
    expect(open).toEqual([expect.objectContaining({ orderId: 'stall-9', status: 'stalled' })]);

    const r1 = await routeStalledBuildOrders(sql, open, now);
    expect(r1).toEqual([
      expect.objectContaining({
        orderId: 'stall-9',
        wrote: true,
        externalId: `stall-9:${berlinDay(now)}`,
      }),
    ]);
    const r2 = await routeStalledBuildOrders(sql, open, now);
    expect(r2[0]?.wrote).toBe(false);

    const stalls = await db.query<{ basket: string; division_id: string; department_id: string; src: string }>(
      `SELECT basket, division_id, department_id, ingest_source AS src
         FROM tasks WHERE ingest_source = 'dept2-stall'`
    );
    expect(stalls.rows).toHaveLength(1);
    expect(stalls.rows[0]).toMatchObject({
      basket: 'in',
      division_id: 'Div1',
      department_id: 'Dept2',
      src: 'dept2-stall',
    });
    expect(stalls.rows[0]!.basket).not.toBe('pending');
  });
});

describe('build-receipt grants ACL (prod datacl)', { timeout: 60_000 }, () => {
  const GRANTS = readRepoFile('scripts/dabos/sql/2026-11-01_build_receipt_role_grants.sql');
  const UNDO = readRepoFile('scripts/dabos/sql/2026-11-01_build_receipt_role_grants.UNDO.sql');
  let db: PGlite;

  beforeEach(async () => {
    db = await setup();
  });
  afterEach(async () => {
    await db.close();
  });

  async function resetRole() {
    await db.exec(`
      DO $$
      DECLARE r text;
      BEGIN
        FOREACH r IN ARRAY ARRAY['dabos_build_receipt', 'br_createrole_owner', 'some_group']
        LOOP
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('DROP OWNED BY %I CASCADE', r);
            EXECUTE format('DROP ROLE %I', r);
          END IF;
        END LOOP;
      END $$;
      REVOKE CREATE ON SCHEMA public FROM PUBLIC;
    `);
    const dbName = (await db.query<{ d: string }>('SELECT current_database() AS d')).rows[0]!.d;
    await db.exec(`
      DO $$ BEGIN
        EXECUTE 'REVOKE CREATE ON DATABASE "${dbName}" FROM PUBLIC';
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);
  }

  it('applies with prod-like PUBLIC =Tc (TEMPORARY+CONNECT) without pre-revoking TEMPORARY', async () => {
    await resetRole();
    const dbName = (await db.query<{ d: string }>('SELECT current_database() AS d')).rows[0]!.d;
    await db.exec(`GRANT CONNECT, TEMPORARY ON DATABASE "${dbName}" TO PUBLIC`);
    const acl = (
      await db.query<{ a: string | null }>(
        `SELECT COALESCE(datacl::text, '') AS a FROM pg_database WHERE datname = current_database()`
      )
    ).rows[0]!.a;
    expect(acl).toMatch(/=T/);
    await db.exec('CREATE ROLE dabos_build_receipt NOLOGIN');
    await db.exec(GRANTS);
    expect(
      (
        await db.query<{ ok: boolean }>(
          `SELECT has_table_privilege('dabos_build_receipt', 'public.tasks', 'INSERT') AS ok`
        )
      ).rows[0]!.ok
    ).toBe(true);
    await db.exec(UNDO);
  });

  it('refuses PUBLIC CREATE on the database; TEMPORARY alone does not refuse', async () => {
    await resetRole();
    const dbName = (await db.query<{ d: string }>('SELECT current_database() AS d')).rows[0]!.d;
    await db.exec(`CREATE ROLE dabos_build_receipt NOLOGIN; GRANT CREATE ON DATABASE "${dbName}" TO PUBLIC`);
    await expect(db.exec(GRANTS)).rejects.toThrow(/guard 3g/);
    await db.exec('ROLLBACK');
    await resetRole();

    await db.exec(`CREATE ROLE dabos_build_receipt NOLOGIN; GRANT TEMP ON DATABASE "${dbName}" TO PUBLIC`);
    await db.exec(GRANTS);
    await db.exec(UNDO);
  });

  it('allows PG16+ CREATEROLE creator ADMIN membership (member = role)', async () => {
    await resetRole();
    await db.exec('CREATE ROLE br_createrole_owner NOLOGIN CREATEROLE');
    await db.exec('SET ROLE br_createrole_owner');
    await db.exec('CREATE ROLE dabos_build_receipt NOLOGIN');
    await db.exec('RESET ROLE');
    await db.exec(GRANTS);
    await db.exec(UNDO);
  });
});
