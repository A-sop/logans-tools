// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildInsertSql, insertSend, type SendInput } from '@/lib/dabos/agent-inbox';
import {
  BATCH_INTERVAL_MS,
  FAILURE_OWNER,
  addDays,
  berlinDate,
  berlinWallToUtc,
  classify,
  formatDecision,
  inBatchWindow,
  makeBatchId,
  nextFailureState,
  parseConfig,
  planDispatch,
  postWebhook,
  redact,
  runTick,
  supersededIds,
  writeDailyMetrics,
  type Decision,
  type FetchLike,
  type GateRow,
  type WatchmanConfig,
} from '@/lib/dabos/watchman';
import { createDabosTestDb, pgliteSql, readRepoFile } from '@/test/pglite-dabos';

// Sun 1 Nov 2026 (CET, UTC+1). 14:00Z = 15:00 Berlin.
const NOW = new Date('2026-11-01T14:00:00Z');
const FAKE_URL = 'https://hooks.example.invalid/fake-hook-path-123';
const FAKE_KEY = 'fake-sender-key-not-real-0000';

let seq = 0;
function row(p: Partial<GateRow> = {}): GateRow {
  seq++;
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    createdAt: new Date(NOW.getTime() - 60_000 * (100 - seq)),
    fromAgent: 'div4',
    toAgent: 'div5',
    subject: 'made-up subject',
    bodyLength: 500,
    urgencyClaim: 'none',
    urgencyReason: null,
    deadlineAt: null,
    blocks: null,
    dedupeKey: `div4:k${seq}`,
    batchId: null,
    dispatchedAt: null,
    gateDecision: null,
    ...p,
  };
}
const d = (r: GateRow, now = NOW) => formatDecision(classify(r, now));

describe('Berlin clock', () => {
  it('handles CET and CEST and the batch window edges', () => {
    expect(berlinWallToUtc('2026-11-01', 7, 0).toISOString()).toBe('2026-11-01T06:00:00.000Z');
    expect(berlinWallToUtc('2026-07-01', 7, 0).toISOString()).toBe('2026-07-01T05:00:00.000Z');
    expect(inBatchWindow(new Date('2026-11-01T05:59:00Z'))).toBe(false); // 06:59
    expect(inBatchWindow(new Date('2026-11-01T06:00:00Z'))).toBe(true); // 07:00
    expect(inBatchWindow(new Date('2026-11-01T21:59:00Z'))).toBe(true); // 22:59
    expect(inBatchWindow(new Date('2026-11-01T22:00:00Z'))).toBe(false); // 23:00
    expect(inBatchWindow(new Date('2026-07-01T05:00:00Z'))).toBe(true); // 07:00 CEST
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(berlinDate(new Date('2026-11-01T23:30:00Z'))).toBe('2026-11-02');
  });
});

describe('gate rules (AC3)', () => {
  it('(a) wakes for Logan and for LDW relaying a Logan order or decision, not for LDW otherwise', () => {
    expect(d(row({ fromAgent: 'logan', subject: 'thanks', bodyLength: 3 }))).toBe('wake:logan');
    expect(d(row({ fromAgent: 'ldw', urgencyReason: 'logan_order: steps 1-3' }))).toBe('wake:logan_relay');
    expect(d(row({ fromAgent: 'ldw', urgencyReason: 'logan_decision' }))).toBe('wake:logan_relay');
    expect(d(row({ fromAgent: 'ldw' }))).toBe('batch:default');
    expect(d(row({ fromAgent: 'div4', urgencyReason: 'logan_order: spoof' }))).toBe('batch:default');
  });

  it('(b) wakes for blocking only when blocks names Logan or a known agent', () => {
    expect(d(row({ urgencyClaim: 'blocking', urgencyReason: 'waits on verdict', blocks: 'logan' }))).toBe('wake:blocking');
    expect(d(row({ urgencyClaim: 'blocking', urgencyReason: 'waits', blocks: 'Div4, ldw' }))).toBe('wake:blocking');
    expect(d(row({ urgencyClaim: 'blocking', urgencyReason: 'waits', blocks: 'Dept13' }))).toBe('wake:blocking');
    expect(d(row({ urgencyClaim: 'blocking', urgencyReason: 'waits', blocks: 'everyone' }))).toBe('batch:default;downgrade:blocks_unknown');
    expect(d(row({ urgencyClaim: 'blocking', urgencyReason: 'waits', blocks: null }))).toBe('batch:default;downgrade:blocks_unknown');
  });

  it('(c) wakes when deadline_at is today in Berlin, at the date edges', () => {
    expect(d(row({ deadlineAt: new Date('2026-11-01T22:59:00Z') }))).toBe('wake:deadline_today'); // 23:59 Berlin
    expect(d(row({ deadlineAt: new Date('2026-11-01T23:00:00Z') }))).toBe('batch:default'); // 00:00 next day
    expect(d(row({ deadlineAt: new Date('2026-10-31T22:59:00Z') }))).toBe('batch:default'); // yesterday 23:59
    expect(d(row({ deadlineAt: new Date('2026-10-31T23:00:00Z') }))).toBe('wake:deadline_today'); // today 00:00
  });

  it('(d) wakes for urgent only with an allowlisted reason code', () => {
    for (const code of ['prod_down', 'data_loss', 'security']) {
      expect(d(row({ urgencyClaim: 'urgent', urgencyReason: `${code}: details` }))).toBe(`wake:urgent_${code}`);
    }
    const soon = new Date(NOW.getTime() + 3 * 3600_000);
    const late = new Date(NOW.getTime() + 8 * 3600_000 + 86400_000);
    expect(d(row({ urgencyClaim: 'urgent', urgencyReason: 'deadline_6h', deadlineAt: soon }))).toBe('wake:urgent_deadline_6h');
    expect(d(row({ urgencyClaim: 'urgent', urgencyReason: 'deadline_6h', deadlineAt: late }))).toBe('batch:default;downgrade:deadline_not_within_6h');
    expect(d(row({ urgencyClaim: 'urgent', urgencyReason: 'please hurry' }))).toBe('batch:default;downgrade:reason_not_allowlisted');
    expect(d(row({ urgencyClaim: 'urgent', urgencyReason: 'prod_downish: x' }))).toBe('batch:default;downgrade:reason_not_allowlisted');
  });

  it('downgrades a claim with no reason to the batch and logs it', () => {
    expect(d(row({ urgencyClaim: 'urgent' }))).toBe('batch:default;downgrade:missing_reason');
    expect(d(row({ urgencyClaim: 'blocking', urgencyReason: '  ', blocks: 'logan' }))).toBe('batch:default;downgrade:missing_reason');
    expect(d(row({ urgencyClaim: 'deadline_today', urgencyReason: 'x' }))).toBe('batch:default;downgrade:no_deadline_at');
    // the claim is ignored but rule (c) still holds on the facts
    expect(d(row({ urgencyClaim: 'deadline_today', deadlineAt: NOW }))).toBe('wake:deadline_today;downgrade:missing_reason');
  });

  it('failed deadline_today claim batches with downgrade:deadline_not_today', () => {
    const tomorrow = new Date('2026-11-02T12:00:00Z');
    const yesterday = new Date('2026-10-31T12:00:00Z');
    expect(d(row({ urgencyClaim: 'deadline_today', urgencyReason: 'ship', deadlineAt: tomorrow }))).toBe(
      'batch:default;downgrade:deadline_not_today'
    );
    expect(d(row({ urgencyClaim: 'deadline_today', urgencyReason: 'ship', deadlineAt: yesterday }))).toBe(
      'batch:default;downgrade:deadline_not_today'
    );
  });

  it('batches FYIs and suppresses bare acknowledgements, never waking for either', () => {
    expect(d(row({ subject: 'FYI: W45 numbers' }))).toBe('batch:fyi');
    expect(d(row({ subject: '[FYI] digest' }))).toBe('batch:fyi');
    for (const s of ['Received', 'noted.', 'Thanks!', 'thank you', 'Re: ack', 'on it', 'standing by']) {
      expect(d(row({ subject: s, bodyLength: 40 }))).toBe('suppress:ack');
    }
    expect(d(row({ subject: 'thanks', bodyLength: 900 }))).toBe('batch:default');
    expect(d(row({ subject: 'Thanks for the fix, one more item' }))).toBe('batch:default');
  });
});

describe('dedupe and supersede (AC3)', () => {
  it('keeps only the newest queued row per key', () => {
    const a = row({ dedupeKey: 'div4:x', createdAt: new Date('2026-11-01T10:00:00Z') });
    const b = row({ dedupeKey: 'div4:x', createdAt: new Date('2026-11-01T11:00:00Z') });
    const c = row({ dedupeKey: 'div4:y' });
    expect(supersededIds([b, a, c])).toEqual([a.id]);
  });
});

describe('batching (AC4)', () => {
  const plan = (rows: GateRow[], now: Date, last: Record<string, string> = {}, hooks = ['div5', 'div4']) => {
    const decisions = new Map<string, Decision>(rows.map((r) => [r.id, classify(r, now)]));
    return planDispatch({
      rows,
      decisions,
      lastDispatch: new Map(Object.entries(last).map(([k, v]) => [k, new Date(v)])),
      hooks: new Set(hooks),
      now,
    });
  };

  it('flushes a non-empty batch only inside 07:00-23:00 Berlin and at most every 2 h', () => {
    const r = row();
    expect(plan([r], new Date('2026-11-01T05:59:00Z')).skips).toEqual([{ to: 'div5', why: 'outside_window', items: 1 }]);
    expect(plan([r], new Date('2026-11-01T06:00:00Z')).dispatches).toEqual([
      { to: 'div5', kind: 'batch', itemIds: [r.id], reason: 'batch' },
    ]);
    expect(plan([r], new Date('2026-11-01T22:00:00Z')).dispatches).toEqual([]);
    expect(plan([r], NOW, { div5: '2026-11-01T12:01:00Z' }).skips).toEqual([{ to: 'div5', why: 'cadence', items: 1 }]);
    expect(plan([r], NOW, { div5: '2026-11-01T12:00:00Z' }).dispatches).toHaveLength(1);
    expect(plan([], NOW).dispatches).toEqual([]);
  });

  it('an urgent wake goes at any hour and carries the queued batch with it', () => {
    const night = new Date('2026-11-01T02:00:00Z'); // 03:00 Berlin
    const fyi = row({ subject: 'FYI x' });
    const urgent = row({ urgencyClaim: 'urgent', urgencyReason: 'prod_down: 500s' });
    const other = row({ toAgent: 'div4' });
    const p = plan([fyi, urgent, other], night, { div5: '2026-11-01T01:50:00Z' });
    expect(p.dispatches).toEqual([{ to: 'div5', kind: 'wake', itemIds: [fyi.id, urgent.id], reason: 'urgent_prod_down' }]);
    expect(p.skips).toEqual([{ to: 'div4', why: 'outside_window', items: 1 }]);
  });

  it('does not re-send a batch POSTed under 2 h ago, re-sends after, and holds agents with no hook', () => {
    const recent = row({ dispatchedAt: new Date(NOW.getTime() - 60_000), batchId: 'b1', urgencyClaim: 'urgent', urgencyReason: 'security' });
    const stale = row({ dispatchedAt: new Date(NOW.getTime() - BATCH_INTERVAL_MS), batchId: 'b0' });
    const noHook = row({ toAgent: 'div3' });
    const p = plan([recent, stale, noHook], NOW, { div5: new Date(NOW.getTime() - 60_000).toISOString() });
    expect(p.dispatches).toEqual([]);
    expect(p.skips).toEqual([
      { to: 'div3', why: 'no_hook', items: 1 },
      { to: 'div5', why: 'cadence', items: 1 },
    ]);
  });

  it('never dispatches suppressed rows', () => {
    expect(plan([row({ subject: 'noted', bodyLength: 0 })], NOW).dispatches).toEqual([]);
  });
});

describe('config, delivery and log hygiene (AC5, AC6)', () => {
  const env = { WATCHMAN_AGENTS: 'div5,div4', WATCHMAN_HOOK_DIV5_URL: FAKE_URL, WATCHMAN_HOOK_DIV5_KEY: FAKE_KEY };

  it('reads hooks by name and reports missing names without values', () => {
    const c = parseConfig(env);
    expect([...c.hooks.keys()]).toEqual(['div5']);
    expect(c.errors).toEqual(['WATCHMAN_HOOK_DIV4_URL is not set', 'WATCHMAN_HOOK_DIV4_KEY is not set']);
    expect(parseConfig({ ...env, WATCHMAN_AGENTS: 'div5,evil' }).errors[0]).toMatch(/unknown agent id/);
    expect(parseConfig({ WATCHMAN_AGENTS: 'div5', WATCHMAN_HOOK_DIV5_URL: 'http://x', WATCHMAN_HOOK_DIV5_KEY: 'k' }).errors).toEqual([
      'WATCHMAN_HOOK_DIV5_URL is not an https URL',
    ]);
    expect(JSON.stringify(c.errors)).not.toContain(FAKE_KEY);
  });

  it('POSTs exactly {to_agent, batch_id, item_ids, reason} with the key in the header', async () => {
    const calls: Array<{ url: string; headers: Record<string, string>; body: string }> = [];
    const fetchFn: FetchLike = async (url, init) => {
      calls.push({ url, headers: init.headers, body: init.body });
      return { ok: true, status: 200 };
    };
    const c = parseConfig(env);
    const res = await postWebhook(fetchFn, c.hooks.get('div5')!, c, { to_agent: 'div5', batch_id: 'b', item_ids: ['i'], reason: 'batch' });
    expect(res).toEqual({ ok: true, status: 'http_200' });
    expect(calls[0]!.url).toBe(FAKE_URL);
    expect(calls[0]!.headers.Authorization).toBe(`Bearer ${FAKE_KEY}`);
    expect(JSON.parse(calls[0]!.body)).toEqual({ to_agent: 'div5', batch_id: 'b', item_ids: ['i'], reason: 'batch' });
    const raw = parseConfig({ ...env, WATCHMAN_KEY_HEADER: 'X-Sender-Key', WATCHMAN_KEY_SCHEME: '' });
    await postWebhook(fetchFn, raw.hooks.get('div5')!, raw, { to_agent: 'div5', batch_id: 'b', item_ids: [], reason: 'x' });
    expect(calls[1]!.headers['X-Sender-Key']).toBe(FAKE_KEY);
    const failing: FetchLike = async () => {
      throw new Error(`connect ECONNREFUSED ${FAKE_URL}`);
    };
    expect(await postWebhook(failing, c.hooks.get('div5')!, c, { to_agent: 'div5', batch_id: 'b', item_ids: [], reason: 'x' })).toEqual({
      ok: false,
      status: 'network_error',
    });
  });

  it('redacts hook URLs, keys and database URLs from any text', () => {
    const c = parseConfig(env);
    const t = redact(`failed ${FAKE_URL} key=${FAKE_KEY} db postgresql://u:p@h/db`, c.hooks);
    expect(t).not.toContain(FAKE_URL);
    expect(t).not.toContain(FAKE_KEY);
    expect(t).not.toContain('u:p@');
  });

  it('batch ids carry kind, recipient and Berlin time', () => {
    expect(makeBatchId('wake', 'div5', NOW, 'abc123')).toBe('wake-div5-20261101T1500-abc123');
  });
});

describe('failure state (Dept13 rule 4)', () => {
  const empty = { open: [], lastCleanFullRun: null };
  it('is cleared only by a full, clean, non-dry run', () => {
    const s1 = nextFailureState(empty, { now: NOW, dryRun: false, complete: true, failureKinds: ['post_failed_div5'] });
    expect(s1.open).toEqual([{ kind: 'post_failed_div5', since: NOW.toISOString(), lastSeen: NOW.toISOString(), owner: FAILURE_OWNER }]);
    const later = new Date(NOW.getTime() + 300_000);
    expect(nextFailureState(s1, { now: later, dryRun: true, complete: true, failureKinds: [] }).open).toHaveLength(1);
    expect(nextFailureState(s1, { now: later, dryRun: false, complete: false, failureKinds: [] }).open).toHaveLength(1);
    const s2 = nextFailureState(s1, { now: later, dryRun: false, complete: true, failureKinds: ['post_failed_div5'] });
    expect(s2.open[0]!.since).toBe(NOW.toISOString());
    expect(s2.open[0]!.lastSeen).toBe(later.toISOString());
    expect(nextFailureState(s2, { now: later, dryRun: false, complete: true, failureKinds: [] })).toEqual({
      open: [],
      lastCleanFullRun: later.toISOString(),
    });
  });
});

// ---------------------------------------------------------------------------------------------
// SQL file and full ticks on PGlite (never Neon).
// Sequential + one shared DB per suite: parallel PGlite instances contended with other heavy
// correction tests and caused 10s hook timeouts in the full suite.
// ---------------------------------------------------------------------------------------------

const SQL_FILE = readRepoFile('scripts/dabos/sql/2026-11-01_watchman_agent_inbox.sql');
const UNDO_FILE = readRepoFile('scripts/dabos/sql/2026-11-01_watchman_agent_inbox.UNDO.sql');

async function freshDb(withRole = true): Promise<PGlite> {
  const db = await createDabosTestDb();
  await db.exec(readRepoFile('migrations/004_role_runs.sql'));
  if (withRole) await db.exec('CREATE ROLE dabos_watchman NOLOGIN');
  return db;
}

describe.sequential('agent_inbox SQL (not applied by this PR) on PGlite', { timeout: 60_000 }, () => {
  // One PGlite for all refusal cases (drop/recreate the role between probes) so the full suite
  // does not open a dozen WASM Postgres instances in parallel with other correction tests.
  let db: PGlite;
  beforeAll(async () => {
    db = await freshDb(false);
  });
  afterAll(async () => {
    if (db) await db.close();
  });
  const can = async (q: string, args: unknown[]) => (await db.query<{ ok: boolean }>(q, args)).rows[0]!.ok;
  const resetRole = async () => {
    await db.exec(`
      DROP TABLE IF EXISTS public.agent_inbox CASCADE;
      DROP TABLE IF EXISTS public.watchman_probe_owned;
      DROP FUNCTION IF EXISTS public.watchman_probe();
      DO $$
      DECLARE r text;
      BEGIN
        FOREACH r IN ARRAY ARRAY['dabos_watchman', 'some_group', 'watchman_createrole_owner', 'watchman_probe_child']
        LOOP
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('DROP OWNED BY %I CASCADE', r);
            EXECUTE format('DROP ROLE %I', r);
          END IF;
        END LOOP;
      END $$;
      REVOKE INSERT ON public.tasks FROM PUBLIC;
      REVOKE CREATE ON SCHEMA public FROM PUBLIC;
    `);
    const dbName = (await db.query<{ d: string }>('SELECT current_database() AS d')).rows[0]!.d;
    await db.exec(`
      DO $$ BEGIN
        EXECUTE 'REVOKE CREATE, TEMPORARY ON DATABASE "${dbName}" FROM PUBLIC';
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);
  };

  it('refuses missing/superuser/member roles and every Amendment-2 footprint fault', async () => {
    await expect(db.exec(SQL_FILE)).rejects.toThrow(/guard 0/);
    await db.exec('ROLLBACK');

    await db.exec('CREATE ROLE dabos_watchman SUPERUSER');
    await expect(db.exec(SQL_FILE)).rejects.toThrow(/guard 1/);
    await db.exec('ROLLBACK');
    await db.exec('ALTER ROLE dabos_watchman NOSUPERUSER; CREATE ROLE some_group; GRANT some_group TO dabos_watchman');
    await expect(db.exec(SQL_FILE)).rejects.toThrow(/guard 1b/);
    await db.exec('ROLLBACK');
    expect((await db.query(`SELECT to_regclass('public.agent_inbox') AS t`)).rows[0]).toEqual({ t: null });
    await resetRole();

    await db.exec('CREATE ROLE dabos_watchman NOLOGIN');
    await db.exec('GRANT SELECT ON public.tasks TO dabos_watchman');
    await expect(db.exec(SQL_FILE)).rejects.toThrow(/guard 4a/);
    await db.exec('ROLLBACK');
    await db.exec('REVOKE SELECT ON public.tasks FROM dabos_watchman; GRANT UPDATE (title) ON public.tasks TO dabos_watchman');
    await expect(db.exec(SQL_FILE)).rejects.toThrow(/guard 4b/);
    await db.exec('ROLLBACK');
    await db.exec('REVOKE UPDATE (title) ON public.tasks FROM dabos_watchman; GRANT CREATE ON SCHEMA public TO dabos_watchman');
    await expect(db.exec(SQL_FILE)).rejects.toThrow(/guard 4c/);
    await db.exec('ROLLBACK');
    await resetRole();

    await db.exec('CREATE ROLE dabos_watchman NOLOGIN; GRANT INSERT ON public.tasks TO PUBLIC');
    await expect(db.exec(SQL_FILE)).rejects.toThrow(/guard 4h/);
    await db.exec('ROLLBACK');
    await resetRole();

    await db.exec('CREATE ROLE dabos_watchman NOLOGIN; GRANT CREATE ON SCHEMA public TO PUBLIC');
    await expect(db.exec(SQL_FILE)).rejects.toThrow(/guard 4i/);
    await db.exec('ROLLBACK');
    await resetRole();

    const dbName = (await db.query<{ d: string }>('SELECT current_database() AS d')).rows[0]!.d;
    await db.exec(`CREATE ROLE dabos_watchman NOLOGIN; GRANT CREATE ON DATABASE "${dbName}" TO PUBLIC`);
    await expect(db.exec(SQL_FILE)).rejects.toThrow(/guard 4i/);
    await db.exec('ROLLBACK');
    await resetRole();

    // PUBLIC TEMPORARY alone must NOT trip guard 4i (Amendment 3).
    await db.exec(`CREATE ROLE dabos_watchman NOLOGIN; GRANT TEMP ON DATABASE "${dbName}" TO PUBLIC`);
    await db.exec(SQL_FILE);
    await resetRole();

    await db.exec(
      `CREATE ROLE dabos_watchman NOLOGIN; CREATE FUNCTION public.watchman_probe() RETURNS int LANGUAGE sql AS $f$ SELECT 1 $f$; GRANT EXECUTE ON FUNCTION public.watchman_probe() TO dabos_watchman`
    );
    await expect(db.exec(SQL_FILE)).rejects.toThrow(/guard 4f/);
    await db.exec('ROLLBACK');
    await resetRole();

    await db.exec(
      `CREATE ROLE dabos_watchman NOLOGIN; CREATE TABLE public.watchman_probe_owned (x int); ALTER TABLE public.watchman_probe_owned OWNER TO dabos_watchman`
    );
    await expect(db.exec(SQL_FILE)).rejects.toThrow(/guard (1b|4e)/);
    await db.exec('ROLLBACK');
    await resetRole();

    await db.exec(
      `CREATE ROLE dabos_watchman NOLOGIN; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO dabos_watchman`
    );
    await expect(db.exec(SQL_FILE)).rejects.toThrow(/guard 4g/);
    await db.exec('ROLLBACK');
    await resetRole();
  });

  it('applies with prod-like PUBLIC =Tc datacl (TEMPORARY+CONNECT) without pre-revoking TEMPORARY', async () => {
    // Mimic Neon prod `=Tc/neondb_owner`: leave PUBLIC TEMPORARY in place (Amendment 3).
    // Deliberately do NOT run resetRole's REVOKE TEMPORARY — that was masking the over-refusal.
    await db.exec(`
      DROP TABLE IF EXISTS public.agent_inbox CASCADE;
      DROP TABLE IF EXISTS public.watchman_probe_owned;
      DROP FUNCTION IF EXISTS public.watchman_probe();
      DO $$
      DECLARE r text;
      BEGIN
        FOREACH r IN ARRAY ARRAY['dabos_watchman', 'some_group', 'watchman_createrole_owner', 'watchman_probe_child']
        LOOP
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('DROP OWNED BY %I CASCADE', r);
            EXECUTE format('DROP ROLE %I', r);
          END IF;
        END LOOP;
      END $$;
      REVOKE INSERT ON public.tasks FROM PUBLIC;
      REVOKE CREATE ON SCHEMA public FROM PUBLIC;
    `);
    const dbName = (await db.query<{ d: string }>('SELECT current_database() AS d')).rows[0]!.d;
    await db.exec(`GRANT CONNECT, TEMPORARY ON DATABASE "${dbName}" TO PUBLIC`);
    const acl = (
      await db.query<{ a: string | null }>(
        `SELECT COALESCE(datacl::text, '') AS a FROM pg_database WHERE datname = current_database()`
      )
    ).rows[0]!.a;
    expect(acl).toMatch(/=T/); // TEMPORARY for PUBLIC present (prod-like)
    await db.exec('CREATE ROLE dabos_watchman NOLOGIN');
    await db.exec(SQL_FILE);
    expect(
      (await db.query<{ ok: boolean }>(`SELECT has_table_privilege('dabos_watchman', 'public.agent_inbox', 'SELECT') AS ok`))
        .rows[0]!.ok
    ).toBe(true);
    await db.exec(`SET dabos.watchman_undo_drop_rows = 'on'`);
    await db.exec(UNDO_FILE);
    await resetRole();
  });

  it('grants succeed for a CREATEROLE-created role; an extra membership still aborts', async () => {
    await resetRole();
    await db.exec('CREATE ROLE watchman_createrole_owner NOLOGIN CREATEROLE');
    await db.exec('SET ROLE watchman_createrole_owner');
    await db.exec('CREATE ROLE dabos_watchman NOLOGIN');
    await db.exec('RESET ROLE');
    await db.exec(SQL_FILE);
    expect(
      (await db.query<{ ok: boolean }>(`SELECT has_table_privilege('dabos_watchman', 'public.agent_inbox', 'SELECT') AS ok`))
        .rows[0]!.ok
    ).toBe(true);
    await db.exec(`SET dabos.watchman_undo_drop_rows = 'on'`);
    await db.exec(UNDO_FILE);
    await resetRole();

    await db.exec('CREATE ROLE watchman_createrole_owner NOLOGIN CREATEROLE');
    await db.exec('SET ROLE watchman_createrole_owner');
    await db.exec('CREATE ROLE dabos_watchman NOLOGIN');
    await db.exec('RESET ROLE');
    await db.exec('CREATE ROLE watchman_probe_child NOLOGIN; GRANT dabos_watchman TO watchman_probe_child');
    await expect(db.exec(SQL_FILE)).rejects.toThrow(/guard 4d/);
    await db.exec('ROLLBACK');
    await resetRole();
  });

  it('creates the table with exact grants, re-runs cleanly, refuses logan from_agent, refuses a foreign shape, and undoes', async () => {
    await resetRole();
    await db.exec('CREATE ROLE dabos_watchman NOLOGIN');
    await db.exec(SQL_FILE);
    await db.exec(SQL_FILE);
    const tp = (t: string, p: string) => can(`SELECT has_table_privilege('dabos_watchman', $1, $2) AS ok`, [t, p]);
    const cp = (c: string, p: string) => can(`SELECT has_column_privilege('dabos_watchman', 'public.agent_inbox', $1, $2) AS ok`, [c, p]);
    expect(await tp('public.agent_inbox', 'SELECT')).toBe(true);
    expect(await tp('public.agent_inbox', 'DELETE')).toBe(false);
    expect(await tp('public.role_runs', 'INSERT')).toBe(true);
    expect(await tp('public.role_runs', 'UPDATE')).toBe(false);
    expect(await tp('public.tasks', 'SELECT')).toBe(false);
    expect(await cp('status', 'UPDATE')).toBe(true);
    expect(await cp('body', 'UPDATE')).toBe(false);
    expect(await cp('delivered_at', 'UPDATE')).toBe(false);
    expect(await cp('body', 'INSERT')).toBe(true);
    expect(await cp('batch_id', 'INSERT')).toBe(false);
    await expect(
      db.exec(`INSERT INTO agent_inbox (from_agent, to_agent, subject, dedupe_key) VALUES ('div4','logan','x','div4:x')`)
    ).rejects.toThrow(/agent_inbox_to_format/);
    await expect(
      db.exec(`INSERT INTO agent_inbox (from_agent, to_agent, subject, dedupe_key) VALUES ('logan','div5','x','logan:x')`)
    ).rejects.toThrow(/agent_inbox_from_format/);
    await expect(
      db.exec(`INSERT INTO agent_inbox (from_agent, to_agent, subject, dedupe_key, status) VALUES ('div4','div5','x','div4:x','done')`)
    ).rejects.toThrow(/agent_inbox_status/);

    await db.exec(`INSERT INTO agent_inbox (from_agent, to_agent, subject, dedupe_key) VALUES ('div4','div5','made-up','div4:x')`);
    await db.exec(`SET dabos.watchman_undo_drop_rows = 'off'`);
    await expect(db.exec(UNDO_FILE)).rejects.toThrow(/has 1 rows/);
    await db.exec('ROLLBACK');
    await db.exec(`SET dabos.watchman_undo_drop_rows = 'on'`);
    await db.exec(UNDO_FILE);
    await db.exec(UNDO_FILE);
    expect((await db.query(`SELECT to_regclass('public.agent_inbox') AS t`)).rows[0]).toEqual({ t: null });
    expect(await tp('public.role_runs', 'INSERT')).toBe(false);

    await db.exec(`CREATE TABLE public.agent_inbox (id uuid)`);
    await expect(db.exec(SQL_FILE)).rejects.toThrow(/guard 3/);
    await db.exec('ROLLBACK');
  });
});

describe.sequential('send, dedupe and full ticks on PGlite', { timeout: 60_000 }, () => {
  let db: PGlite;
  let calls: Array<{ url: string; body: string; headers: Record<string, string> }>;
  let status: number;
  let lines: string[];
  const fetchFn: FetchLike = async (url, init) => {
    calls.push({ url, body: init.body, headers: init.headers });
    return { ok: status >= 200 && status < 300, status };
  };
  const config = (): WatchmanConfig =>
    parseConfig({
      WATCHMAN_AGENTS: 'div5,div4',
      WATCHMAN_HOOK_DIV5_URL: FAKE_URL,
      WATCHMAN_HOOK_DIV5_KEY: FAKE_KEY,
      WATCHMAN_HOOK_DIV4_URL: `${FAKE_URL}-4`,
      WATCHMAN_HOOK_DIV4_KEY: `${FAKE_KEY}-4`,
    });
  const tick = (now: Date, dryRun = false) =>
    runTick({ sql: pgliteSql(db), fetchFn, config: config(), now, dryRun, log: (l) => lines.push(l), randomId: () => 'r00001' });
  const send = (p: Partial<SendInput>) =>
    insertSend(pgliteSql(db), {
      from: 'div4',
      to: 'div5',
      subject: 'made-up subject',
      body: 'SECRET-BODY-TEXT made-up body',
      claim: 'none',
      reason: null,
      deadlineAt: null,
      blocks: null,
      dedupeKey: 'div4:topic-a',
      ...p,
    });
  const statuses = async () =>
    (await db.query<{ subject: string; status: string; gate_decision: string | null; batch_id: string | null }>(
      `SELECT subject, status, gate_decision, batch_id FROM agent_inbox ORDER BY created_at, id`
    )).rows;

  // One shared PGlite for the whole suite; truncate between tests instead of open/close thrash.
  beforeAll(async () => {
    db = await freshDb();
    await db.exec(SQL_FILE);
  });
  beforeEach(async () => {
    await db.exec(`DELETE FROM agent_inbox; DELETE FROM role_runs WHERE role_id LIKE 'watchman%'`);
    calls = [];
    status = 200;
    lines = [];
  });
  afterAll(async () => {
    if (db) await db.close();
  });

  it('the documented one-statement INSERT works and drops exact duplicates', async () => {
    const input: SendInput = {
      from: 'div4',
      to: 'div5',
      subject: "it's made-up",
      body: 'b',
      claim: 'none',
      reason: null,
      deadlineAt: null,
      blocks: null,
      dedupeKey: 'div4:dup',
    };
    const first = await db.query<{ id: string }>(buildInsertSql(input));
    const second = await db.query<{ id: string }>(buildInsertSql(input));
    expect(first.rows).toHaveLength(1);
    expect(second.rows).toHaveLength(0);
    expect(await send({ dedupeKey: 'div4:dup2' })).toMatch(/^[0-9a-f-]{36}$/);
    expect(await send({ dedupeKey: 'div4:dup2' })).toBeNull();
  });

  it('dry run decides and prints but writes nothing and POSTs nothing', async () => {
    await send({ claim: 'urgent', reason: 'prod_down: made-up' });
    const before = JSON.stringify(await statuses());
    const res = await tick(NOW, true);
    expect(res.wakes).toBe(1);
    expect(calls).toHaveLength(0);
    expect(JSON.stringify(await statuses())).toBe(before);
    expect(lines.some((l) => l.startsWith('[dry run] would dispatch kind=wake to=div5'))).toBe(true);
    expect((await db.query(`SELECT count(*)::int AS n FROM role_runs`)).rows[0]).toEqual({ n: 0 });
  });

  it('supersedes, suppresses, wakes with flush-along, then batches on cadence; logs hold no secrets or text', async () => {
    await send({ subject: 'first version', dedupeKey: 'div4:topic-a' });
    await new Promise((r) => setTimeout(r, 20)); // distinct created_at
    await send({ subject: 'second version', dedupeKey: 'div4:topic-a' });
    await send({ subject: 'thanks', body: 'ok', dedupeKey: 'div4:thanks-1' });
    await send({ subject: 'FYI made-up', dedupeKey: 'div4:fyi-1' });
    await send({ claim: 'urgent', reason: 'please', subject: 'no allowlisted reason', dedupeKey: 'div4:u1' });

    // 15:00 Berlin, never dispatched: batch goes out (window open, no last dispatch).
    const r1 = await tick(NOW);
    expect(r1).toMatchObject({ superseded: 1, suppressed: 1, wakes: 0, batches: 1 });
    expect(calls).toHaveLength(1);
    const payload = JSON.parse(calls[0]!.body);
    expect(payload.to_agent).toBe('div5');
    expect(payload.batch_id).toBe('batch-div5-20261101T1500-r00001');
    expect(payload.item_ids).toHaveLength(3);
    expect(Object.keys(payload).sort()).toEqual(['batch_id', 'item_ids', 'reason', 'to_agent']);
    const s1 = await statuses();
    expect(s1.map((r) => [r.subject, r.status, r.gate_decision]).sort((a, b) => a[0]!.localeCompare(b[0]!))).toEqual([
      ['first version', 'superseded', 'superseded'],
      ['FYI made-up', 'queued', 'batch:fyi'],
      ['no allowlisted reason', 'queued', 'batch:default;downgrade:reason_not_allowlisted'],
      ['second version', 'queued', 'batch:default'],
      ['thanks', 'suppressed', 'suppress:ack'],
    ]);

    // 10 minutes later a new FYI: cadence holds it. Then a blocking item wakes and carries it.
    await send({ subject: 'FYI two', dedupeKey: 'div4:fyi-2' });
    const t2 = new Date(NOW.getTime() + 10 * 60_000);
    const r2 = await tick(t2);
    expect(r2.batches + r2.wakes).toBe(0);
    expect(r2.skips).toEqual([{ to: 'div5', why: 'cadence', items: 1 }]);
    await send({ claim: 'blocking', reason: 'div4 waits on the verdict', blocks: 'div4', subject: 'need verdict', dedupeKey: 'div4:b1' });
    const r3 = await tick(new Date(t2.getTime() + 5 * 60_000));
    expect(r3.wakes).toBe(1);
    expect(JSON.parse(calls[1]!.body)).toMatchObject({ reason: 'blocking' });
    expect(JSON.parse(calls[1]!.body).item_ids).toHaveLength(2);

    // the routine marks delivered; 2 h later nothing is pending, so nothing is sent
    await db.exec(`UPDATE agent_inbox SET status = 'delivered', delivered_at = now() WHERE batch_id IS NOT NULL`);
    const r4 = await tick(new Date(NOW.getTime() + 3 * 3600_000));
    expect(r4.batches + r4.wakes).toBe(0);
    expect(calls).toHaveLength(2);

    const log = lines.join('\n');
    for (const secret of [FAKE_URL, FAKE_KEY, 'SECRET-BODY-TEXT', 'made-up', 'version', 'need verdict']) {
      expect(log).not.toContain(secret);
    }
    expect(log).toMatch(/decision=batch:default;downgrade:reason_not_allowlisted/);
  });

  it('a failed POST releases the batch, files one div4 failure row a day, and retries', async () => {
    status = 500;
    await send({ claim: 'urgent', reason: 'data_loss: made-up' });
    const r1 = await tick(NOW);
    expect(r1.failures.map((f) => f.kind)).toEqual(['post_failed_div5']);
    expect((await statuses()).find((r) => r.subject === 'made-up subject')!.batch_id).toBeNull();
    const fail = await db.query<{ from_agent: string; to_agent: string; body: string }>(
      `SELECT from_agent, to_agent, body FROM agent_inbox WHERE dedupe_key LIKE 'watchman:failure:%'`
    );
    expect(fail.rows).toHaveLength(1);
    expect(fail.rows[0]).toMatchObject({ from_agent: 'watchman', to_agent: 'div4' });
    expect(fail.rows[0]!.body).toContain(FAILURE_OWNER);
    expect(fail.rows[0]!.body).not.toContain(FAKE_URL);

    await tick(new Date(NOW.getTime() + 5 * 60_000));
    expect(
      (await db.query(`SELECT count(*)::int AS n FROM agent_inbox WHERE dedupe_key LIKE 'watchman:failure:post_failed_div5:%'`)).rows[0]
    ).toEqual({ n: 1 });

    status = 200;
    const r3 = await tick(new Date(NOW.getTime() + 10 * 60_000));
    expect(r3.wakes).toBe(1);
    expect(r3.failures).toEqual([]);
    expect(calls.filter((c) => c.url === FAKE_URL).length).toBe(3);
  });

  it('writes one daily metrics row to role_runs for the previous Berlin day (AC7)', async () => {
    await send({ subject: 'FYI a', dedupeKey: 'div4:m1' });
    await send({ subject: 'noted', body: '', dedupeKey: 'div4:m2' });
    await send({ claim: 'urgent', reason: 'security: made-up', dedupeKey: 'div4:m3' });
    // insertSend stamps created_at with wall-clock now(); pin to the frozen NOW so the
    // Berlin-day metrics window (2026-11-01) matches dispatched_at from tick(NOW).
    await db.exec(`UPDATE agent_inbox SET created_at = '${NOW.toISOString()}'`);
    await tick(NOW);
    await db.exec(
      `UPDATE agent_inbox SET status = 'delivered', delivered_at = '${NOW.toISOString()}' WHERE batch_id IS NOT NULL`
    );
    const nextDay = new Date('2026-11-02T08:00:00Z');
    const r = await tick(nextDay);
    expect(r.metrics).toBe('written');
    expect(await writeDailyMetrics(pgliteSql(db), '2026-11-01')).toBe('exists');
    const m = await db.query<{ role_type: string; s: Record<string, unknown> }>(
      `SELECT role_type, summary_json AS s FROM role_runs WHERE role_id = 'watchman_daily' AND summary_json->>'day' = '2026-11-01'`
    );
    expect(m.rows).toHaveLength(1);
    expect(m.rows[0]!.role_type).toBe('cadence');
    expect(m.rows[0]!.s).toMatchObject({ day: '2026-11-01', items: 3, wakes: 1, woken_items: 2, suppressed: 1 });
  });
});

describe('ln02 files and runner hygiene (AC6)', () => {
  const service = readRepoFile('scripts/dabos/ln02/dabos-watchman.service');
  const timer = readRepoFile('scripts/dabos/ln02/dabos-watchman.timer');
  const install = readRepoFile('scripts/dabos/ln02/install-watchman.sh').replace(/\r\n/g, '\n'); // CRLF-safe on Windows checkouts
  const runner = readRepoFile('scripts/dabos/watchman.ts');
  const lib = readRepoFile('src/lib/dabos/watchman.ts');

  it('service loads secrets only from the env file and holds none inline', () => {
    expect(service).toMatch(/^EnvironmentFile=%h\/\.config\/dabos\/watchman\.env$/m);
    const envLines = service.split(/\r?\n/).filter((l) => l.startsWith('Environment='));
    expect(envLines.map((l) => l.split('=')[1])).toEqual(['PATH', 'WATCHMAN_STATE_DIR']);
    expect(service).toMatch(/^ExecStart=@NODE_BIN@\/npm run --silent dabos:watchman$/m);
  });

  it('timer ticks every 5 minutes', () => {
    expect(timer.split(/\r?\n/).filter((l) => l.startsWith('OnCalendar='))).toEqual(['OnCalendar=*-*-* *:00/5:00']);
    expect(timer).toMatch(/^Unit=dabos-watchman\.service$/m);
  });

  it('install script defaults to dry run; installs and undoes only with --apply; never prints the env file', () => {
    expect(install).toMatch(/^APPLY=0$/m);
    const undoGate = install.indexOf('if [ "$UNDO" -eq 1 ]; then');
    const undoApply = install.indexOf('if [ "$APPLY" -ne 1 ]; then', undoGate);
    const undoAction = install.indexOf('systemctl --user disable --now', undoApply);
    expect(undoGate).toBeGreaterThan(0);
    expect(undoApply).toBeGreaterThan(undoGate);
    expect(undoAction).toBeGreaterThan(undoApply);
    const gate = install.lastIndexOf('if [ "$APPLY" -ne 1 ]; then');
    for (const action of ['install -m 644', 'systemctl --user daemon-reload\nsystemctl --user enable', 'mkdir -p "$UNIT_DIR"']) {
      expect(install.indexOf(action)).toBeGreaterThan(gate);
    }
    expect(install).not.toMatch(/cat "\$ENV_FILE"|source "\$ENV_FILE"|\. "\$ENV_FILE"|grep [^q]*"\$ENV_FILE"[^|]*$/m);
    expect(install).toMatch(/grep -qE "\^\$\{name\}=\.\+" "\$ENV_FILE"/);
    expect(install).toMatch(/-E WATCHMAN_DRY_RUN=1/);
  });

  it('runner and lib never load .env.local, read only WATCHMAN_ names, and never ask for command lines', () => {
    for (const src of [runner, lib]) {
      expect(src).not.toMatch(/load-env|loadEnvLocal|\.env\.local'|dotenv/);
      expect(src).not.toMatch(/child_process|execFile|spawn\(|ps aux|CommandLine/);
    }
    const names = [...runner.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((m) => m[1]);
    for (const n of names) expect(n).toMatch(/^WATCHMAN_/);
    expect(lib).not.toMatch(/process\.env/);
    expect(lib).toMatch(/length\(body\) AS body_length/);
    expect(lib).not.toMatch(/SELECT[^;]*\bbody,/);
  });

  it('package.json wires the npm scripts', () => {
    const pkg = readRepoFile('package.json');
    expect(pkg).toContain('"dabos:watchman": "tsx scripts/dabos/watchman.ts"');
    expect(pkg).toContain('"dabos:inbox": "tsx scripts/dabos/dabos-inbox.ts"');
  });
});
