/**
 * Cancel stuck or failed DABOS agent tasks (Neon).
 *
 *   npx tsx scripts/dabos/cancel-agent-tasks.ts --id 047115f1-5055-46cd-876e-215d4af50d70
 *   npx tsx scripts/dabos/cancel-agent-tasks.ts --blocked-research
 *   npx tsx scripts/dabos/cancel-agent-tasks.ts --list
 */
import { createDabosSql } from '../../src/lib/dabos/dabos-connection';
import { requireDatabaseUrl } from './load-env';

async function main() {
  const args = process.argv.slice(2);
  const listOnly = args.includes('--list');
  const blockedResearch = args.includes('--blocked-research');
  const idIdx = args.indexOf('--id');
  const taskId = idIdx >= 0 ? args[idIdx + 1] : null;

  const sql = createDabosSql(requireDatabaseUrl());

  const open = await sql`
    SELECT id, title, status, assigned_agent, updated_at::text
    FROM tasks
    WHERE type = 'agent'
      AND status IN ('todo', 'doing', 'blocked')
    ORDER BY updated_at DESC
    LIMIT 30
  `;

  console.log('=== open agent tasks ===');
  for (const r of open) console.log(r);

  if (listOnly) return;

  const ids: string[] = [];
  if (taskId) ids.push(taskId);
  if (blockedResearch) {
    for (const r of open) {
      if (r.status === 'blocked' || r.status === 'doing') {
        ids.push(r.id as string);
      }
    }
  }

  const unique = [...new Set(ids)];
  if (!unique.length) {
    console.log('Nothing to cancel (pass --id or --blocked-research)');
    return;
  }

  for (const id of unique) {
    const rows = await sql`
      UPDATE tasks
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = ${id}::uuid
        AND type = 'agent'
        AND status IN ('todo', 'doing', 'blocked')
      RETURNING id, title, status
    `;
    if (rows[0]) console.log('cancelled:', rows[0]);
    else console.log('skip (not found or not open):', id);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
