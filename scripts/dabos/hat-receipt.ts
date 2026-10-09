/**
 * Close a hat activation: role_runs receipt + task basket out.
 *
 *   npm run dabos:hat-receipt -- --dept Dept20 --task <id> --summary "text" [--artifact path]
 */
import os from 'os';
import { execSync } from 'child_process';

import { createDabosSql } from '../../src/lib/dabos/dabos-connection';
import { requireDatabaseUrl } from './load-env';

function argValue(args: string[], name: string): string | null {
  const idx = args.indexOf(name);
  if (idx < 0) return null;
  const value = args[idx + 1];
  if (!value || value.startsWith('--')) return null;
  return value;
}

function normalizeDept(raw: string): string | null {
  const match = raw.trim().match(/^Dept0*(\d{1,2})$/i);
  if (!match) return null;
  const n = Number(match[1]);
  if (n < 1 || n > 21) return null;
  return `Dept${n}`;
}

function gitHead(): string | null {
  try {
    return execSync('git rev-parse HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dept = normalizeDept(argValue(args, '--dept') ?? '');
  const taskArg = argValue(args, '--task');
  const summary = argValue(args, '--summary');
  const artifact = argValue(args, '--artifact');

  if (!dept || !taskArg || !summary) {
    console.error(
      'Usage: npm run dabos:hat-receipt -- --dept DeptN --task <id> --summary "<text>" [--artifact <path>]'
    );
    process.exit(1);
  }

  const sql = createDabosSql(requireDatabaseUrl());
  const rows = await sql`
    SELECT id::text AS id, basket
    FROM tasks
    WHERE id::text = ${taskArg}
       OR (${taskArg.length >= 8} AND id::text LIKE ${`${taskArg}%`})
    LIMIT 2
  `;

  if (rows.length !== 1) {
    console.error(rows.length === 0 ? `No task for ${taskArg}` : `Task id ${taskArg} is ambiguous`);
    process.exit(1);
  }

  const taskId = String(rows[0].id);
  const payload = {
    task: taskId,
    artifact: artifact,
    host: os.hostname(),
    commit: gitHead(),
    dept,
    summary,
  };

  await sql`
    INSERT INTO role_runs (role_id, role_type, summary_json)
    VALUES (
      ${dept},
      ${'department'},
      ${JSON.stringify(payload)}::jsonb
    )
  `;

  const updated = await sql`
    UPDATE tasks
    SET basket = 'out', updated_at = NOW()
    WHERE id = ${taskId}::uuid
    RETURNING id::text AS id, basket
  `;

  if (updated.length !== 1) {
    console.error(`Receipt written but basket update missed task ${taskId}`);
    process.exit(1);
  }

  console.log(`role_runs ${dept} task ${taskId} basket ${updated[0].basket}`);

  if ('end' in sql && typeof sql.end === 'function') {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
