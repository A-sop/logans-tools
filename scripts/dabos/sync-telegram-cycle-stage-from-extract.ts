/**
 * Dept1 — backfill Neon cycle_stage from local _extract-state.json (stage 2 when extracted).
 *
 *   npx tsx scripts/dabos/sync-telegram-cycle-stage-from-extract.ts [--dry-run] [--limit N]
 *
 * Does not change basket/dept (route-captures.ts owns routing). Rollback CSV under DABOS_ROLLBACK_DIR.
 */
import fs from 'fs';
import path from 'path';

import { createDabosSql } from '../../src/lib/dabos/dabos-connection';
import { deriveIngestMouthKind } from '../../src/lib/dabos/ingest-cycle-meta';
import { requireDatabaseUrl } from './load-env';

const EXTRACTED = new Set(['extracted', 'routed', 'leisure', 'needs_login']);
const DABOS_ROOT = process.env.DABOS_ROOT || path.resolve(__dirname, '../../../DABOS');
const STATE_PATH = path.join(DABOS_ROOT, 'docs/wiki/inbox/_extract-state.json');
const ROLLBACK_DIR = process.env.DABOS_ROLLBACK_DIR || 'C:\\DATA\\10_WORK\\dabos-rollback';

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

type StateRow = { id: string; status?: string; type?: string; rel?: string };

function csvCell(v: unknown): string {
  const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return '"' + s.replace(/"/g, '""') + '"';
}

async function main() {
  const dry = process.argv.includes('--dry-run');
  const limit = Math.max(1, Number(arg('--limit') ?? '50'));
  const state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8').replace(/^\uFEFF/, '')) as {
    rows: StateRow[];
  };
  const byBundle = new Map<string, StateRow>();
  for (const row of state.rows ?? []) {
    if (row.id) byBundle.set(row.id, row);
  }

  const sql = createDabosSql(requireDatabaseUrl());
  const open = await sql`
    SELECT id, title, ingest_meta
    FROM tasks
    WHERE basket = 'pending'
      AND ingest_source = 'telegram'
      AND status NOT IN ('done', 'cancelled')
    ORDER BY created_at ASC`;
  const candidates: { task: (typeof open)[0]; row: StateRow }[] = [];
  for (const task of open) {
    const bundle = (task as { ingest_meta?: { wiki_bundle?: string } }).ingest_meta?.wiki_bundle;
    if (!bundle) continue;
    const row = byBundle.get(String(bundle));
    if (!row?.status || !EXTRACTED.has(row.status)) continue;
    if ((task as { ingest_meta?: { cycle_stage?: number } }).ingest_meta?.cycle_stage === 2) continue;
    candidates.push({ task, row });
  }
  const slice = candidates.slice(0, limit);

  const batch = `sync-cycle-stage-${new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)}`;
  const day = new Date().toISOString().slice(0, 10);
  const backup = path.join(ROLLBACK_DIR, `${day}-sync-telegram-cycle-stage.csv`);
  if (!dry) {
    fs.mkdirSync(ROLLBACK_DIR, { recursive: true });
    const header = ['batch', 'id', 'ingest_meta'].map(csvCell).join(',');
    fs.writeFileSync(backup, header + '\n', 'utf8');
  }

  let updated = 0;
  for (const { task, row } of slice) {
    const prev = (task as { ingest_meta?: Record<string, unknown> }).ingest_meta ?? {};
    const rel = row.rel?.replace(/^docs\/wiki\/inbox\//, '') ?? row.id;
    const extractPath = `docs/wiki/sources/telegram/${row.id.replace(/[^a-zA-Z0-9_-]+/g, '-')}.md`;
    const mouthKind =
      (prev.mouth_kind as string | undefined)?.trim() ||
      deriveIngestMouthKind({
        mouth: 'telegram',
        text: String((task as { title?: string }).title ?? ''),
        urls: (prev.urls as string[] | undefined) ?? [],
        attachments: (prev.attachments as string[] | undefined) ?? [],
      });
    const next = {
      ...prev,
      mouth_kind: mouthKind,
      cycle_stage: 2,
      extract_status: row.status,
      extract_path: extractPath,
      wiki_bundle_rel: rel,
      cycle_synced_at: new Date().toISOString(),
      cycle_sync_batch: batch,
    };
    if (!dry) {
      fs.appendFileSync(
        backup,
        [batch, (task as { id: string }).id, JSON.stringify(prev)].map(csvCell).join(',') + '\n',
        'utf8'
      );
      await sql`
        UPDATE tasks
        SET ingest_meta = ${JSON.stringify(next)}::jsonb, updated_at = now()
        WHERE id = ${(task as { id: string }).id}`;
    }
    updated++;
  }

  console.log(
    JSON.stringify(
      {
        dry_run: dry,
        neon_telegram_pending: open.length,
        extract_state_rows: state.rows?.length ?? 0,
        matched_extracted: candidates.length,
        updated_this_run: updated,
        limit,
        rollback: dry ? null : backup,
        batch,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
