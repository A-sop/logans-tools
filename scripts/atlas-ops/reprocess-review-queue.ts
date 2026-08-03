#!/usr/bin/env npx tsx
/**
 * Re-run classification on registry rows already in the review pipeline.
 * Preserves review decisions (upsert does not overwrite approved / filing fields).
 */
import * as path from 'path';
import { processRegistryFile } from '@/lib/atlas-ops/document-intake/process-registry-file';
import { getRegistryPaths } from '@/lib/atlas-ops/document-intake/registry-config';
import { DocumentRegistryIndex } from '@/lib/atlas-ops/document-intake/registry-sqlite';

function parseLimit(args: string[]): number | null {
  const arg = args.find((a) => a.startsWith('--limit='));
  if (!arg) return null;
  const n = Number.parseInt(arg.split('=')[1] ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parsePathContains(args: string[]): string | null {
  const arg = args.find((a) => a.startsWith('--path-contains='));
  if (!arg) return null;
  const value = arg.split('=').slice(1).join('=').trim();
  return value.length > 0 ? value : null;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const limit = parseLimit(args);
  const pathContains = parsePathContains(args);
  const includeDecided = args.includes('--include-decided');

  const paths = getRegistryPaths();
  const index = new DocumentRegistryIndex(paths.registryDbPath);

  try {
    let rows = index.listForReviewExport('review_required');
    if (!includeDecided) {
      rows = rows.filter((row) => row.approved === 'pending' || row.approved === '');
    }
    if (pathContains) {
      const needle = pathContains.replace(/\//g, '\\').toLowerCase();
      rows = rows.filter((row) => row.source_path.replace(/\//g, '\\').toLowerCase().includes(needle));
    }
    if (limit) rows = rows.slice(0, limit);

    console.log('DIL reprocess — registry review queue');
    console.log(`- registry_db: ${paths.registryDbPath}`);
    console.log(`- rows: ${rows.length}`);
    console.log(`- path_contains: ${pathContains ?? '(all)'}`);
    console.log(`- include_decided: ${includeDecided}`);

    const startedAt = Date.now();
    let processed = 0;
    let failed = 0;

    for (let i = 0; i < rows.length; i++) {
      const sourcePath = rows[i]!.source_path;
      if (i % 25 === 0) {
        console.log(`… ${i}/${rows.length} (${path.basename(sourcePath)})`);
      }
      try {
        const result = await processRegistryFile(sourcePath, index, { forceReprocess: true });
        if (!result.skipped) processed += 1;
      } catch (error) {
        failed += 1;
        console.error('FAILED:', sourcePath, error instanceof Error ? error.message : error);
      }
    }

    const after = index.listForReviewExport('review_required');
    const counts = new Map<string, number>();
    for (const row of after) {
      counts.set(row.proposed_basename, (counts.get(row.proposed_basename) ?? 0) + 1);
    }
    const topDupes = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

    console.log('Reprocess complete.');
    console.log(`- processed: ${processed}`);
    console.log(`- failed: ${failed}`);
    console.log(`- elapsed_ms: ${Date.now() - startedAt}`);
    console.log('- top proposed basenames (review_required):');
    for (const [basename, count] of topDupes) {
      console.log(`  · ${count}x ${basename}`);
    }
  } finally {
    index.close();
  }
}

main().catch((error: unknown) => {
  console.error('reprocess-review-queue failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
