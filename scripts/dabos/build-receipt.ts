/**
 * Zero-token build hand-off receipts (no LLM).
 *
 *   npm run dabos:build-receipt -- start --order-id <id> --repo <r> --branch <b> \
 *     --machine <m> --expected-finish <ISO> [--pr <url>]...
 *   npm run dabos:build-receipt -- finish --order-id <id> --status done|failed [--pr <url>]...
 *   npm run dabos:build-receipt -- route-stalls
 *   npm run dabos:route-stalls
 *
 * Database: DABOS_BUILD_RECEIPT_DATABASE_URL only (no DATABASE_URL fallback).
 * Acceptance: docs/acceptance/2026-11-01_build_receipts_open_orders_stall.ACCEPTANCE.md
 *             + AMENDMENT-1.md
 */
import { createDabosSql } from '../../src/lib/dabos/dabos-connection';
import {
  readOpenOrders,
  routeStalledBuildOrders,
  writeFinishReceipt,
  writeStartReceipt,
  type FinishStatus,
} from '../../src/lib/dabos/build-receipt';

/** Dedicated least-privilege URL. Never falls back to DATABASE_URL / .env.local owner. */
export function requireBuildReceiptDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env
): string {
  const url = env.DABOS_BUILD_RECEIPT_DATABASE_URL?.trim();
  if (!url) {
    console.error(
      'DABOS_BUILD_RECEIPT_DATABASE_URL is required (no fallback to DATABASE_URL); see ~/.config/dabos/build-receipt.env'
    );
    process.exit(1);
  }
  return url;
}

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
      '  npm run dabos:route-stalls',
    ].join('\n')
  );
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  if (cmd !== 'start' && cmd !== 'finish' && cmd !== 'route-stalls') usage();

  const sql = createDabosSql(requireBuildReceiptDatabaseUrl());

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

const isDirectRun =
  typeof process.argv[1] === 'string' &&
  /(?:^|[/\\])build-receipt\.ts$/.test(process.argv[1].replace(/\\/g, '/'));

if (isDirectRun) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
