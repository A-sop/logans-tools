/**
 * Zero-token build hand-off receipts (no LLM).
 *
 *   npm run dabos:build-receipt -- start --order-id <id> --repo <r> --branch <b> \
 *     --machine <m> --expected-finish <ISO> [--pr <url>]...
 *   npm run dabos:build-receipt -- finish --order-id <id> --status done|failed [--pr <url>]...
 *   npm run dabos:build-receipt -- route-stalls
 *
 * Acceptance: docs/acceptance/2026-11-01_build_receipts_open_orders_stall.ACCEPTANCE.md
 */
import { createDabosSql } from '../../src/lib/dabos/dabos-connection';
import {
  readOpenOrders,
  routeStalledBuildOrders,
  writeFinishReceipt,
  writeStartReceipt,
  type FinishStatus,
} from '../../src/lib/dabos/build-receipt';
import { requireDatabaseUrl } from './load-env';

function argValue(args: string[], name: string): string | null {
  const idx = args.indexOf(name);
  if (idx < 0) return null;
  const value = args[idx + 1];
  if (!value || value.startsWith('--')) return null;
  return value;
}

function argAll(args: string[], name: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === name && args[i + 1] && !args[i + 1]!.startsWith('--')) {
      out.push(args[++i]!);
    }
  }
  return out;
}

function usage(): never {
  console.error(
    [
      'Usage:',
      '  npm run dabos:build-receipt -- start --order-id <id> --repo <r> --branch <b> --machine <m> --expected-finish <ISO> [--pr <url>]...',
      '  npm run dabos:build-receipt -- finish --order-id <id> --status done|failed [--pr <url>]...',
      '  npm run dabos:build-receipt -- route-stalls',
    ].join('\n')
  );
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  if (cmd !== 'start' && cmd !== 'finish' && cmd !== 'route-stalls') usage();

  const sql = createDabosSql(requireDatabaseUrl());

  try {
    if (cmd === 'start') {
      const orderId = argValue(args, '--order-id');
      const repo = argValue(args, '--repo');
      const branch = argValue(args, '--branch');
      const machine = argValue(args, '--machine');
      const expectedFinish = argValue(args, '--expected-finish');
      if (!orderId || !repo || !branch || !machine || !expectedFinish) usage();
      const result = await writeStartReceipt(sql, {
        orderId,
        repo,
        branch,
        machine,
        expectedFinish,
        prLinks: argAll(args, '--pr'),
      });
      console.log(
        result.wrote
          ? `build-receipt start wrote ${result.externalId}`
          : `build-receipt start idempotent ${result.externalId}`
      );
      return;
    }

    if (cmd === 'finish') {
      const orderId = argValue(args, '--order-id');
      const status = argValue(args, '--status') as FinishStatus | null;
      if (!orderId || (status !== 'done' && status !== 'failed')) usage();
      const result = await writeFinishReceipt(sql, {
        orderId,
        status,
        prLinks: argAll(args, '--pr'),
      });
      console.log(
        result.wrote
          ? `build-receipt finish wrote ${result.externalId}`
          : `build-receipt finish idempotent ${result.externalId}`
      );
      return;
    }

    const now = new Date();
    const open = await readOpenOrders(sql, now);
    const stalled = open.filter((o) => o.status === 'stalled');
    const routed = await routeStalledBuildOrders(sql, stalled, now);
    const wrote = routed.filter((r) => r.wrote).length;
    console.log(`route-stalls: ${stalled.length} stalled, ${wrote} new Dept2 IN rows`);
  } finally {
    if ('end' in sql && typeof sql.end === 'function') {
      await sql.end({ timeout: 5 });
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
