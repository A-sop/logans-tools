/**
 * Test-only helper: in-process Postgres (PGlite) with the real DABOS migrations needed for
 * stats/conditions reader tests, plus a tagged-template adapter shaped like DabosSql.
 * Never connects to Neon or any network database.
 */
import fs from 'fs';
import path from 'path';

import { PGlite } from '@electric-sql/pglite';

import type { DabosSql } from '@/lib/dabos/dabos-connection';

const repoRoot = path.resolve(__dirname, '../..');

export function readRepoFile(rel: string): string {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
}

/** Base schema (001) + stats provenance (017); optionally the supersede migration (021). */
export async function createDabosTestDb(opts: { withSupersede?: boolean } = {}): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(readRepoFile('migrations/001_create_tables.sql'));
  await db.exec(readRepoFile('migrations/017_stats_provenance.sql'));
  if (opts.withSupersede !== false) {
    await db.exec(readRepoFile('migrations/021_stats_conditions_superseded.sql'));
  }
  return db;
}

/** Tagged-template SQL adapter (`sql\`... ${v}\``) returning rows, like neon()/postgres(). */
export function pgliteSql(db: PGlite): DabosSql {
  const tag = (strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0] ?? '';
    values.forEach((_, i) => {
      text += `$${i + 1}${strings[i + 1] ?? ''}`;
    });
    return db.query(text, values as unknown[]).then((r) => r.rows);
  };
  return tag as unknown as DabosSql;
}
