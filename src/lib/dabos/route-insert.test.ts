// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDabosTestDb, pgliteSql, readRepoFile } from '@/test/pglite-dabos';

import { insertRoutedCapture } from '../../../scripts/dabos/route-insert';

/**
 * Runs the real `npm run dabos:route` INSERT (scripts/dabos/route-insert.ts) against an
 * in-process Postgres with $n params. Dept13 FAIL v1 on #48: a `//` comment inside the sql
 * template reached Postgres and broke every run. Made-up data only; never touches Neon.
 */
describe('dabos:route INSERT on PGlite (Dept1 intake rule)', () => {
  let db: PGlite;

  beforeEach(async () => {
    db = await createDabosTestDb({ withSupersede: false });
    await db.exec(readRepoFile('migrations/002_seed_org.sql'));
    await db.exec(readRepoFile('migrations/018_task_ingest_basket.sql'));
  });

  afterEach(async () => {
    await db.close();
  });

  it('parses, executes, and writes an agent task with no founder assignment', async () => {
    const id = await insertRoutedCapture(pgliteSql(db), {
      divisionId: 'Div1',
      title: 'Routed idea',
      description: "an idea with an apostrophe: it's fine\n\nIN: api route:test",
      externalId: 'route:test-from:1',
      meta: { mouth: 'api', external_id: 'route:test-from:1', suggested_dept: 'Dept11' },
    });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);

    const r = await db.query<{
      type: string;
      assigned_to: string | null;
      department_id: string;
      basket: string;
      ingest_source: string;
      ingest_meta: { mouth: string };
    }>(
      `SELECT type, assigned_to, department_id, basket, ingest_source, ingest_meta FROM tasks WHERE id = $1`,
      [id]
    );
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].type).toBe('agent');
    expect(r.rows[0].assigned_to).toBeNull();
    expect(r.rows[0].department_id).toBe('Dept1');
    expect(r.rows[0].basket).toBe('in');
    expect(r.rows[0].ingest_source).toBe('api');
    expect(r.rows[0].ingest_meta.mouth).toBe('api');
  });
});