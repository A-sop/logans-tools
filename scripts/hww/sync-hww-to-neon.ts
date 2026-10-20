/**
 * Push local hww:build JSON into Neon. Fail closed on client-data patterns.
 *
 * Usage: npm run hww:sync
 * Env: DATABASE_URL or DATABASE_URL_UNPOOLED (+ HWW_DATA_DIR optional)
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';

import { requireDatabaseUrl } from '../dabos/load-env';
import { assertNoClientData } from '../../src/lib/hww/no-client-data';
import type { HwwRecord, HwwSummary } from '../../src/lib/hww/load';
import { DEFAULT_HWW_DATA_DIR } from '../../src/lib/hww/paths';

const BATCH = 200;

function dataDir(): string {
  const fromEnv = process.env.HWW_DATA_DIR?.trim();
  const dir = fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_HWW_DATA_DIR;
  if (!existsSync(dir)) {
    console.error('HWW_DATA_DIR missing or unreadable:', dir);
    process.exit(2);
  }
  return dir;
}

async function main() {
  const fallback = requireDatabaseUrl(); // loads .env.local
  const url = process.env.DATABASE_URL_UNPOOLED?.trim() || fallback;
  const dir = dataDir();
  const summaryPath = path.join(dir, 'hww-summary.json');
  const recordsPath = path.join(dir, 'hww-records.json');
  if (!existsSync(summaryPath) || !existsSync(recordsPath)) {
    console.error('Run npm run hww:build first (missing summary/records)');
    process.exit(2);
  }

  const summary = JSON.parse(readFileSync(summaryPath, 'utf8')) as HwwSummary;
  const raw = JSON.parse(readFileSync(recordsPath, 'utf8')) as { records?: HwwRecord[] } | HwwRecord[];
  const records = Array.isArray(raw) ? raw : (raw.records ?? []);

  const guard = assertNoClientData({ summary, records });
  if (!guard.ok) {
    console.error('HWW_SYNC_ABORT no-client-data:', guard.reason);
    process.exit(3);
  }

  const builtAt = summary.built_at;
  if (!builtAt) {
    console.error('summary.built_at required');
    process.exit(2);
  }

  const sql = postgres(url, { max: 1, prepare: false });
  try {
    await sql.begin(async (tx) => {
      await tx`
        INSERT INTO hww_summaries (built_at, provisional_wealth, summary, flags, sections, synced_at)
        VALUES (
          ${builtAt}::timestamptz,
          ${Boolean(summary.provisional_wealth)},
          ${tx.json(summary as never)},
          ${tx.json((summary.flags ?? []) as never)},
          ${tx.json((summary.sections ?? []) as never)},
          NOW()
        )
        ON CONFLICT (built_at) DO UPDATE SET
          provisional_wealth = EXCLUDED.provisional_wealth,
          summary = EXCLUDED.summary,
          flags = EXCLUDED.flags,
          sections = EXCLUDED.sections,
          synced_at = NOW()
      `;

      // Replace all rows for this snapshot, then keep only latest N snapshots' records
      await tx`DELETE FROM hww_records WHERE built_at = ${builtAt}::timestamptz`;

      for (let i = 0; i < records.length; i += BATCH) {
        const chunk = records.slice(i, i + BATCH);
        const rows = chunk.map((r) => ({
          built_at: builtAt,
          stat: r.stat,
          date: r.date,
          stat_week: r.stat_week ?? null,
          value: r.value == null ? null : String(r.value),
          unit: r.unit ?? null,
          area: r.area ?? null,
          kind: r.kind ?? null,
          source_file: r.source_file,
          source_key: r.source_key,
          meta: JSON.stringify(r.meta ?? {}),
        }));
        await tx`
          INSERT INTO hww_records ${tx(
            rows,
            'built_at',
            'stat',
            'date',
            'stat_week',
            'value',
            'unit',
            'area',
            'kind',
            'source_file',
            'source_key',
            'meta',
          )}
        `;
      }

      // Prune older snapshots (keep 14)
      await tx`
        DELETE FROM hww_records
        WHERE built_at NOT IN (
          SELECT built_at FROM hww_summaries ORDER BY built_at DESC LIMIT 14
        )
      `;
      await tx`
        DELETE FROM hww_summaries
        WHERE built_at NOT IN (
          SELECT built_at FROM (
            SELECT built_at FROM hww_summaries ORDER BY built_at DESC LIMIT 14
          ) keep
        )
      `;
    });

    const [{ n }] = await sql<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM hww_records WHERE built_at = ${builtAt}::timestamptz
    `;
    console.log('HWW_SYNC_OK built_at=', builtAt, 'records=', n);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error('HWW_SYNC_FAIL', e);
  process.exit(1);
});
