#!/usr/bin/env npx tsx
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { getRegistryPaths, isFrozenDestination, pathHasExcludedSegment } from '@/lib/dabos-ops/document-intake/registry-config';
import { DocumentRegistryIndex } from '@/lib/dabos-ops/document-intake/registry-sqlite';

function parseArgs(argv: string[]): {
  execute: boolean;
  renameOnly: boolean;
  importCsv: boolean;
  csvPath: string | null;
} {
  return {
    execute: argv.includes('--execute'),
    renameOnly: argv.includes('--rename-only'),
    importCsv: argv.includes('--import-csv'),
    csvPath: (() => {
      const arg = argv.find((a) => a.startsWith('--csv='));
      return arg ? arg.split('=').slice(1).join('=') : null;
    })(),
  };
}

async function importApprovedFromCsv(csvPath: string, index: DocumentRegistryIndex): Promise<number> {
  const raw = await fs.readFile(csvPath, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return 0;

  const header = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').trim());
  const pathIdx = header.indexOf('source_path');
  const approvedIdx = header.indexOf('approved');
  if (pathIdx < 0 || approvedIdx < 0) {
    throw new Error('CSV must include source_path and approved columns');
  }

  let updated = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const sourcePath = cols[pathIdx]?.replace(/^"|"$/g, '');
    const approved = (cols[approvedIdx]?.replace(/^"|"$/g, '') ?? '').trim().toUpperCase();
    if (!sourcePath) continue;
    if (approved === 'Y') {
      index.updateApproved(sourcePath, 'Y');
      updated += 1;
    } else     if (approved === 'N') {
      index.updateApproved(sourcePath, 'N');
      updated += 1;
    } else if (approved === 'L') {
      index.updateApproved(sourcePath, 'L');
      updated += 1;
    } else if (approved === 'FLAG' || approved === 'flag') {
      index.updateApproved(sourcePath, 'flag');
      updated += 1;
    }
  }
  return updated;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const { execute, renameOnly, importCsv, csvPath } = parseArgs(argv);
  const paths = getRegistryPaths();

  const index = new DocumentRegistryIndex(paths.registryDbPath);

  try {
    if (importCsv) {
      const targetCsv = csvPath ?? paths.reviewCsvPath;
      const count = await importApprovedFromCsv(targetCsv, index);
      console.log(`Imported approved flags from CSV: ${count} row(s) updated`);
    }

    const approved = index.getApprovedForApply();
    // Guard 4 (2026-07-12): files under an active bulk keep-ruling never move
    // via per-file apply â€” the subtree-level decision wins.
    const Database = (await import('better-sqlite3')).default;
    const bdb = new Database(paths.registryDbPath, { readonly: true });
    const keepRoots = (bdb
      .prepare(
        `SELECT root_path FROM bulk_decisions WHERE status='active'
         AND lane IN ('project-keep','work-keep','client-manual','skip-onenote')`,
      )
      .all() as Array<{ root_path: string }>).map((r) => r.root_path + path.sep);
    bdb.close();
    const actions: Array<{ action: 'rename' | 'move'; from: string; to: string }> = [];

    for (const row of approved) {
      if (pathHasExcludedSegment(row.source_path)) {
        console.log(`SKIP (Â§4 exclude): ${row.source_path}`);
        continue;
      }
      if (isFrozenDestination(row.effective_relative_path)) {
        console.log(`SKIP (frozen admin): ${row.effective_relative_path}`);
        continue;
      }
      if (keepRoots.some((r) => row.source_path.startsWith(r))) {
        console.log(`SKIP (bulk keep-ruling covers subtree): ${row.source_path}`);
        continue;
      }
      // Guard 1 (2026-07-12): stale registry rows â€” file already moved by a
      // riff executor; renaming a missing source would crash the whole run.
      if (!fsSync.existsSync(row.source_path)) {
        console.log(`SKIP (source gone - stale row): ${row.source_path}`);
        continue;
      }
      // Guard 2: never execute machine placeholder names (v2-quality junk).
      if (/unknownorg|unknownperson|ohne-nr/i.test(row.effective_basename)) {
        console.log(`SKIP (placeholder name, not filing-grade): ${row.effective_basename}`);
        continue;
      }
      // Guard 3: Approve on a riffed row means "riff accepted", NOT "execute
      // the machine proposal". Without keep-filename or explicit overrides,
      // the riff still needs interpretation â€” do not act on it here.
      const review = index.getReviewEntry(row.source_path);
      const humanRiff = (review?.review_notes ?? '').trim();
      const hasExplicitFiling =
        review?.review_keep_filename === 1 ||
        (review?.review_basename_override ?? '') !== '' ||
        (review?.review_relative_path_override ?? '') !== '';
      if (humanRiff && !humanRiff.startsWith('[') && !hasExplicitFiling) {
        console.log(`SKIP (riffed, awaiting interpretation): ${row.source_path}`);
        continue;
      }

      const destFull = path.join(paths.dataRoot, row.effective_relative_path);
      const renameTarget = path.join(path.dirname(row.source_path), row.effective_basename);

      if (row.source_path !== renameTarget) {
        actions.push({ action: 'rename', from: row.source_path, to: renameTarget });
      }
      if (!renameOnly && renameTarget !== destFull) {
        actions.push({ action: 'move', from: renameTarget, to: destFull });
      }
    }

    console.log(`Approved manifest: ${actions.length} action(s) (${approved.length} files)`);
    console.log(`Mode: ${execute ? 'EXECUTE' : 'DRY-RUN'}`);

    for (const step of actions) {
      const line = `${step.action}: ${step.from} -> ${step.to}`;
      if (!execute) {
        console.log(`[dry-run] ${line}`);
        continue;
      }
      await fs.mkdir(path.dirname(step.to), { recursive: true });
      await fs.rename(step.from, step.to);
      console.log(`[done] ${line}`);
    }

    if (!execute) {
      console.log('Pass --execute to apply. Use --import-csv after editing review CSV.');
    }
  } finally {
    index.close();
  }
}

main().catch((error: unknown) => {
  console.error('apply-approved-manifest failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
