/**
 * Read-only rollback CSV before comm-center normalisation / re-basketing.
 *
 *   npm run dabos:comm-center-rollback-export -- [--out path.csv]
 *
 * Writes id,basket,status,assigned_agent,division_id,department_id,ingest_meta
 * for every row that normalisation or re-basketing may touch, plus sha256 on stdout.
 */
import fs from 'fs';
import path from 'path';

import { createDabosSql } from '../../src/lib/dabos/dabos-connection';
import {
  buildRollbackCsv,
  isRebasketTouchRow,
  needsNormalisation,
  ROLLBACK_SELECT_SQL,
  type TouchRow,
} from '../../src/lib/dabos/comm-center/rollback-export';
import { requireDatabaseUrl } from './load-env';

function argValue(args: string[], name: string): string | null {
  const idx = args.indexOf(name);
  if (idx < 0) return null;
  const value = args[idx + 1];
  if (!value || value.startsWith('--')) return null;
  return value;
}

async function main() {
  const args = process.argv.slice(2);
  const out =
    argValue(args, '--out') ??
    path.join(process.cwd(), `comm-center-rollback-${new Date().toISOString().slice(0, 10)}.csv`);

  const sql = createDabosSql(requireDatabaseUrl());
  // Keep the SELECT in sync with ROLLBACK_SELECT_SQL (tagged template; no string concat).
  void ROLLBACK_SELECT_SQL;
  const rows = (await sql`
    SELECT id::text AS id,
           basket,
           status,
           assigned_agent,
           division_id,
           department_id,
           ingest_meta
      FROM tasks
     WHERE basket = 'in'
        OR assigned_agent IS NOT NULL
     ORDER BY id
  `) as TouchRow[];

  const touch = rows.filter((r) => isRebasketTouchRow(r) || needsNormalisation(r));
  const { csv, sha256, count } = buildRollbackCsv(touch);
  fs.writeFileSync(out, csv, 'utf8');
  console.log(`wrote ${count} rows → ${out}`);
  console.log(`sha256 ${sha256}`);

  if ('end' in sql && typeof sql.end === 'function') {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
