/**
 * One-shot: run executeResearchTask for a task id (local Neon + OpenRouter/Ollama).
 * Usage: npx tsx scripts/dabos/run-one-research-task.ts <uuid>
 */
import { createDabosSql, resolveDabosDatabaseUrl } from '../../src/lib/dabos/dabos-connection';
import { executeResearchTask } from '../../src/lib/dabos/task-runner';
import { loadEnvLocal } from './load-env';

async function main() {
  loadEnvLocal();
  const id = process.argv[2];
  if (!id) {
    console.error('Usage: npx tsx scripts/dabos/run-one-research-task.ts <task-uuid>');
    process.exit(1);
  }
  const url = resolveDabosDatabaseUrl();
  if (!url) {
    console.error('DATABASE_URL missing');
    process.exit(1);
  }
  const sql = createDabosSql(url);
  console.log('running research for', id);
  const result = await executeResearchTask(sql as never, id);
  console.log(JSON.stringify(result, null, 2));
  if ('end' in sql && typeof sql.end === 'function') {
    await sql.end();
  }
  process.exit(result.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
