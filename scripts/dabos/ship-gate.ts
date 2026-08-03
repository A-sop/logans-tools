/**
 * CLI: emit Div4 shipped_outputs from ship-log after Dept13 PASS.
 * npm run dabos:ship-gate -- [--ship-row N]
 */
import { createDabosSql } from '../../src/lib/dabos/dabos-connection';
import { refreshAllConditionsFromBoardWithSql } from '../../src/lib/dabos/board-conditions-query';
import { emitShippedOutputsFromShipLog } from '../../src/lib/dabos/ship-gate-emit';
import { loadEnvLocal, requireDatabaseUrl } from './load-env';

async function main() {
  loadEnvLocal();
  const url = requireDatabaseUrl();
  const args = process.argv.slice(2);
  let shipRow: number | undefined;
  const idx = args.indexOf('--ship-row');
  if (idx >= 0 && args[idx + 1]) shipRow = Number(args[idx + 1]);

  const sql = createDabosSql(url);
  const emit = await emitShippedOutputsFromShipLog({ dabosSql: sql, shipRow });
  console.log(JSON.stringify(emit, null, 2));
  await refreshAllConditionsFromBoardWithSql(sql);
  console.log('Conditions refreshed');
  if ('end' in sql && typeof sql.end === 'function') {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
