/**
 * CLI: Dept3 missing-primary crawl.
 * npm run dabos:stat-crawl
 */
import { createDabosSql } from '../../src/lib/dabos/dabos-connection';
import { runStatCrawl } from '../../src/lib/dabos/stat-crawl';
import { loadEnvLocal, requireDatabaseUrl } from './load-env';

async function main() {
  loadEnvLocal();
  const url = requireDatabaseUrl();
  const sql = createDabosSql(url);
  const result = await runStatCrawl({ dabosSql: sql });
  console.log(JSON.stringify(result, null, 2));
  if ('end' in sql && typeof sql.end === 'function') {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
