/**
 * Wake/batch stub: list (or mark) unprocessed founder replies on approval_queue.
 *
 * Usage:
 *   npm run dabos:process-approval-replies
 *   npm run dabos:process-approval-replies -- --mark <uuid>
 *   npm run dabos:process-approval-replies -- --mark-all   # after you handled the batch
 *
 * Agents wake → poll unprocessed → act on short founder_reply text only → set reply_processed_at.
 * Not a messaging inbox. See src/docs/dabos/approval-queue.md § Founder reply.
 */
import { requireDatabaseUrl } from './load-env';
import { createDabosSql } from '../../src/lib/dabos/dabos-connection';

type ReplyRow = {
  id: string;
  status: string;
  title: string;
  founder_reply: string;
  decided_at: string | null;
  decided_by: string | null;
};

async function main() {
  const args = process.argv.slice(2);
  const markAll = args.includes('--mark-all');
  const markIdx = args.indexOf('--mark');
  const markId = markIdx >= 0 ? args[markIdx + 1]?.trim() : undefined;

  const url = requireDatabaseUrl();
  const sql = createDabosSql(url);

  if (markId) {
    const updated = await sql`
      UPDATE approval_queue
      SET reply_processed_at = NOW()
      WHERE id = ${markId}::uuid
        AND founder_reply IS NOT NULL
        AND reply_processed_at IS NULL
      RETURNING id::text AS id, title
    `;
    if (!updated.length) {
      console.error(`No unprocessed reply for id ${markId}`);
      process.exit(1);
    }
    console.log(`Marked processed: ${updated[0].id} — ${updated[0].title}`);
    return;
  }

  const rows = (await sql`
    SELECT
      id::text AS id,
      status,
      title,
      founder_reply,
      decided_at::text AS decided_at,
      decided_by
    FROM approval_queue
    WHERE founder_reply IS NOT NULL
      AND reply_processed_at IS NULL
      AND status IN ('approved', 'rejected')
    ORDER BY decided_at ASC NULLS LAST
    LIMIT 50
  `) as ReplyRow[];

  if (!rows.length) {
    console.log('No unprocessed founder replies.');
    return;
  }

  console.log(`Unprocessed founder replies: ${rows.length}\n`);
  for (const r of rows) {
    console.log(`--- ${r.id}`);
    console.log(`${r.status} · ${r.title}`);
    console.log(`by ${r.decided_by ?? '?'} @ ${r.decided_at ?? '?'}`);
    console.log(r.founder_reply);
    console.log('');
  }

  if (markAll) {
    const ids = rows.map((r) => r.id);
    await sql`
      UPDATE approval_queue
      SET reply_processed_at = NOW()
      WHERE id = ANY(${ids}::uuid[])
        AND reply_processed_at IS NULL
    `;
    console.log(`Marked ${ids.length} reply(ies) processed.`);
    return;
  }

  console.log('Dry list only. After handling: --mark <uuid> or --mark-all');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
