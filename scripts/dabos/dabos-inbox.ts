/**
 * RR-010 step 1: `dabos-inbox send`, the CLI way to leave a message for another agent (AC2).
 *
 *   npm run --silent dabos:inbox -- send --from div4 --to div5 --subject "logans-tools #63 ready" \
 *     --key div4:lt-pr-63-ready --body "Head <sha>. Dept13 checklist in the PR." [--claim blocking \
 *     --reason "div4 waits on the verdict" --blocks div4] [--deadline "2026-11-02 18:00"] [--print-sql]
 *
 * With DABOS_INBOX_DATABASE_URL set it inserts the row and prints the new id (or "duplicate").
 * Without it, or with --print-sql, it prints the one-statement INSERT to run through the Neon tool.
 * It never reads .env files and never prints the connection string.
 * Standard: src/docs/dabos/agent-inbox.md.
 */
import fs from 'fs';

import { buildInsertSql, insertSend, parseSendArgs, validateSend } from '../../src/lib/dabos/agent-inbox';
import { createDabosSql } from '../../src/lib/dabos/dabos-connection';

async function main() {
  const args = parseSendArgs(process.argv.slice(2));
  if (args.command !== 'send') {
    console.error('usage: dabos-inbox send --from <agent> --to <agent> --subject <text> --key <dedupe key> [options]');
    process.exit(2);
  }
  if (args.bodyFile) args.input.body = fs.readFileSync(args.bodyFile === '-' ? 0 : args.bodyFile, 'utf8');
  const errors = validateSend(args.input);
  if (errors.length) {
    for (const e of errors) console.error(`refused: ${e}`);
    process.exit(1);
  }
  const url = process.env.DABOS_INBOX_DATABASE_URL?.trim();
  if (args.printSql || !url) {
    process.stdout.write(buildInsertSql(args.input) + '\n');
    return;
  }
  const id = await insertSend(createDabosSql(url), args.input);
  console.log(id ? `queued ${id}` : 'duplicate (same key and text already in the inbox)');
}

main().catch((e) => {
  console.error(`dabos-inbox failed: ${(e instanceof Error ? e.message : String(e)).replace(/postgres(ql)?:\/\/\S+/g, '[db-url]')}`);
  process.exit(1);
});
