// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { decisionKey } from '@/lib/dabos/approval-queue-standard';
import { readRepoFile } from '@/test/pglite-dabos';

/**
 * Guards of scripts/dabos/sql/2026-11-01_approval_queue_decision_keys.sql (+ UNDO), on made-up
 * rows in an in-process Postgres. The table is built in the shape read on Neon prod on
 * 1 Nov 2026 (migration 012's 14 columns, no check or FK constraints). Nothing here connects to
 * any network database.
 */
const APPLY = readRepoFile('scripts/dabos/sql/2026-11-01_approval_queue_decision_keys.sql');
const UNDO = readRepoFile('scripts/dabos/sql/2026-11-01_approval_queue_decision_keys.UNDO.sql');

const PROD_SHAPE = `
CREATE TABLE approval_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_by TEXT NOT NULL DEFAULT 'system',
  decided_by TEXT,
  division_id TEXT,
  department_id TEXT,
  task_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);
CREATE INDEX idx_approval_queue_status ON approval_queue (status, created_at DESC);
INSERT INTO approval_queue (id, kind, title, status, decided_by, created_at, decided_at) VALUES
  ('11111111-1111-4111-8111-111111111111', 'other', 'made-up row one', 'approved', 'founder', '2026-07-11T14:00:00Z', '2026-07-11T14:05:00Z'),
  ('22222222-2222-4222-8222-222222222222', 'other', 'made-up row two', 'approved', NULL, '2026-07-11T14:07:45.916Z', NULL);
`;

const DIGEST = `SELECT count(*)::int AS n, md5(string_agg(concat_ws('|', id::text, coalesce(workspace_id, '<null>'), kind,
  title, coalesce(body, '<null>'), payload::text, status, requested_by, coalesce(decided_by, '<null>'),
  coalesce(division_id, '<null>'), coalesce(department_id, '<null>'), coalesce(task_id::text, '<null>'),
  to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
  coalesce(to_char(decided_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'), '<null>')), E'\\n' ORDER BY id)) AS d
  FROM approval_queue`;

async function hasColumn(db: PGlite): Promise<boolean> {
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'approval_queue' AND column_name = 'dedupe_key'`
  );
  return r.rows[0]!.n === 1;
}

const SHA = 'a'.repeat(40);

describe('2026-11-01 approval_queue decision keys SQL', () => {
  let db: PGlite;
  beforeEach(async () => {
    db = new PGlite();
    await db.exec(PROD_SHAPE);
  });
  afterEach(async () => {
    await db.close();
  });

  it('adds the column, check and unique partial index without touching existing rows', async () => {
    const before = (await db.query(DIGEST)).rows[0];
    await db.exec(APPLY);
    expect(await hasColumn(db)).toBe(true);
    expect((await db.query(DIGEST)).rows[0]).toEqual(before);
    const nulls = await db.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM approval_queue WHERE dedupe_key IS NULL'
    );
    expect(nulls.rows[0]!.n).toBe(2);
  });

  it('a re-run is a no-op', async () => {
    await db.exec(APPLY);
    await db.query(
      `INSERT INTO approval_queue (kind, title, dedupe_key) VALUES ('other', 'x', 'policy:wake-rules')`
    );
    const before = await db.query('SELECT * FROM approval_queue ORDER BY id');
    await db.exec(APPLY);
    expect((await db.query('SELECT * FROM approval_queue ORDER BY id')).rows).toEqual(before.rows);
  });

  it('makes filing idempotent with ON CONFLICT on the partial index', async () => {
    await db.exec(APPLY);
    const key = decisionKey({
      decision: 'merge',
      repo: 'A-sop/logans-tools',
      pr: 61,
      headSha: SHA,
    });
    const ins = `INSERT INTO approval_queue (kind, title, payload, requested_by, dedupe_key)
      VALUES ('other', 'Merge logans-tools #61?', '{"decision":"merge"}'::jsonb, 'Div4', $1)
      ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING`;
    await db.query(ins, [key]);
    await db.query(ins, [key]);
    const r = await db.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM approval_queue WHERE dedupe_key = $1',
      [key]
    );
    expect(r.rows[0]!.n).toBe(1);
    // NULL keys stay unconstrained (old rows, Tier0 API rows).
    await db.query(
      `INSERT INTO approval_queue (kind, title) VALUES ('other', 'a'), ('other', 'b')`
    );
  });

  it('rejects a malformed key', async () => {
    await db.exec(APPLY);
    await expect(
      db.query(
        `INSERT INTO approval_queue (kind, title, dedupe_key) VALUES ('other', 'x', 'merge #61')`
      )
    ).rejects.toThrow();
    await expect(
      db.query(
        `INSERT INTO approval_queue (kind, title, dedupe_key) VALUES ('other', 'x', 'deploy:thing')`
      )
    ).rejects.toThrow();
  });

  it('aborts on a partial state and changes nothing', async () => {
    await db.exec('ALTER TABLE approval_queue ADD COLUMN dedupe_key text');
    await expect(db.exec(APPLY)).rejects.toThrow(/guard 1: partial state/);
    await db.exec('ROLLBACK').catch(() => undefined);
    const idx = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_indexes WHERE indexname = 'uq_approval_queue_dedupe_key'`
    );
    expect(idx.rows[0]!.n).toBe(0);
  });

  it('aborts when the table shape differs from prod', async () => {
    await db.exec('ALTER TABLE approval_queue ADD COLUMN surprise text');
    await expect(db.exec(APPLY)).rejects.toThrow(/guard 0b/);
    await db.exec('ROLLBACK').catch(() => undefined);
    expect(await hasColumn(db)).toBe(false);
  });

  it('undo removes only its own objects and is re-runnable', async () => {
    const before = (await db.query(DIGEST)).rows[0];
    await db.exec(APPLY);
    await db.exec(UNDO);
    await db.exec(UNDO);
    expect(await hasColumn(db)).toBe(false);
    expect((await db.query(DIGEST)).rows[0]).toEqual(before);
    const idx = await db.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'approval_queue' ORDER BY 1`
    );
    expect(idx.rows.map((r) => r.indexname)).toEqual([
      'approval_queue_pkey',
      'idx_approval_queue_status',
    ]);
  });

  it('undo refuses while any row carries a key', async () => {
    await db.exec(APPLY);
    await db.query(
      `INSERT INTO approval_queue (kind, title, dedupe_key) VALUES ('other', 'x', 'policy:wake-rules')`
    );
    await expect(db.exec(UNDO)).rejects.toThrow(/undo guard 1/);
    await db.exec('ROLLBACK').catch(() => undefined);
    expect(await hasColumn(db)).toBe(true);
  });

  it('also applies on a migration-012 shaped table (checks and FKs present)', async () => {
    const m012 = readRepoFile('migrations/012_approval_queue.sql').split('-- Dept21')[0]!;
    const db2 = new PGlite();
    await db2.exec(`
      CREATE TABLE divisions (id TEXT PRIMARY KEY);
      CREATE TABLE departments (id TEXT PRIMARY KEY);
      CREATE TABLE tasks (id UUID PRIMARY KEY DEFAULT gen_random_uuid());
    `);
    await db2.exec(m012);
    await db2.exec(APPLY);
    expect(await hasColumn(db2)).toBe(true);
    await db2.close();
  });
});
