#!/usr/bin/env npx tsx
import * as fs from 'fs/promises';
import * as path from 'path';
import { processRegistryFile, walkInboxFiles } from '@/lib/dabos-ops/document-intake/process-registry-file';
import { processUnprocessedInboxBatch } from '@/lib/dabos-ops/document-intake/process-inbox-batch';
import { DIL_REVIEW_BATCH_LIMIT } from '@/lib/dabos-ops/document-intake/review-config';
import { getRegistryPaths, pathHasExcludedSegment, resolveSourceRoot } from '@/lib/dabos-ops/document-intake/registry-config';
import { DocumentRegistryIndex } from '@/lib/dabos-ops/document-intake/registry-sqlite';

function parsePositiveIntArg(args: string[], prefix: string): number | null {
  const arg = args.find((a) => a.startsWith(`${prefix}=`));
  if (!arg) return null;
  const n = Number.parseInt(arg.split('=')[1] ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseStringArg(args: string[], prefix: string): string | null {
  const arg = args.find((a) => a.startsWith(`${prefix}=`));
  if (!arg) return null;
  const value = arg.slice(prefix.length + 1).trim();
  // Strip optional surrounding quotes (Windows shells sometimes retain them).
  const unquoted = value.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
  return unquoted.length > 0 ? unquoted : null;
}

function parseLimit(args: string[]): number | null {
  const fromArg = parsePositiveIntArg(args, '--limit');
  if (fromArg) return fromArg;
  const envLimit = process.env.DOC_REGISTRY_LIMIT;
  if (envLimit) {
    const n = Number.parseInt(envLimit, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

async function selectNewestFiles(filePaths: string[], count: number): Promise<string[]> {
  const withMtime = await Promise.all(
    filePaths.map(async (filePath) => {
      const stat = await fs.stat(filePath);
      return { filePath, mtimeMs: stat.mtimeMs };
    })
  );
  return withMtime
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, count)
    .map((entry) => entry.filePath);
}

async function loadInventoryPolicyMap(csvPath: string | null): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!csvPath) return map;
  try {
    const raw = await fs.readFile(csvPath, 'utf8');
    const lines = raw.split(/\r?\n/);
    const header = lines[0]?.split(',') ?? [];
    const pathIdx = header.indexOf('full_path');
    const policyIdx = header.indexOf('policy');
    if (pathIdx < 0 || policyIdx < 0) return map;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const cols = line.split(',');
      const fullPath = cols[pathIdx]?.replace(/^"|"$/g, '');
      const policy = cols[policyIdx]?.replace(/^"|"$/g, '');
      if (fullPath && policy) map.set(fullPath, policy);
    }
  } catch {
    console.log(`- note: inventory CSV not loaded (${csvPath})`);
  }
  return map;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const forceReprocess = args.includes('--force-reprocess');
  const forceUnprocessedOnly = args.includes('--unprocessed-only');
  const limit = parseLimit(args);
  const newest = parsePositiveIntArg(args, '--newest');
  const cliSource = parseStringArg(args, '--source');

  const basePaths = getRegistryPaths();
  // --source=<abs path> retargets registration onto an arbitrary folder (Tranche A:
  // 10_WORK, 20_ADMIN, OneDrive-DVAG). Absent â†’ today's DATA inbox behavior, unchanged.
  const paths = resolveSourceRoot(basePaths, cliSource);
  await fs.mkdir(paths.manifestsDir, { recursive: true });

  const sourceExists = await fs
    .stat(paths.inboxRoot)
    .then((s) => s.isDirectory())
    .catch(() => false);

  if (!sourceExists) {
    console.error(`Source folder not found: ${paths.inboxRoot}`);
    process.exit(1);
  }
  if (cliSource) {
    console.log(`- source_override: ${paths.inboxRoot}`);
  }

  const inventoryMap = await loadInventoryPolicyMap(paths.inventoryCsvPath);
  const allFiles = (await walkInboxFiles(paths.inboxRoot)).filter((f) => !pathHasExcludedSegment(f));

  const index = new DocumentRegistryIndex(paths.registryDbPath);

  if (forceUnprocessedOnly) {
    const batchLimit = limit ?? DIL_REVIEW_BATCH_LIMIT;
    try {
      const result = await processUnprocessedInboxBatch(index, {
        limit: batchLimit,
        inboxRoot: paths.inboxRoot,
        inventoryPolicyForPath: (filePath) => inventoryMap.get(filePath) ?? null,
      });
      console.log('Document Intelligence â€” unprocessed inbox batch');
      console.log(`- inbox: ${paths.inboxRoot}`);
      console.log(`- unprocessed_in_inbox: ${result.candidates}`);
      console.log(`- batch_limit: ${batchLimit}`);
      console.log(`- processed: ${result.processed}`);
      console.log(`- skipped_dedupe: ${result.skipped}`);
      console.log(`- review_required: ${result.reviewRequired}`);
      console.log(`- done: ${result.done}`);
      console.log(`- metadata_only: ${result.metadataOnly}`);
      console.log(`- failed: ${result.failed}`);
      console.log(`- elapsed_ms: ${result.elapsedMs}`);
      console.log(`- remaining_unprocessed: ${Math.max(0, result.candidates - result.processed)}`);
    } finally {
      index.close();
    }
    return;
  }

  let files = allFiles;
  if (newest) {
    files = await selectNewestFiles(allFiles, newest);
  } else if (limit) {
    files = allFiles.slice(0, limit);
  }

  console.log('Document Intelligence â€” process DATA inbox');
  console.log(`- inbox: ${paths.inboxRoot}`);
  console.log(`- registry_db: ${paths.registryDbPath}`);
  console.log(`- files_found: ${allFiles.length} (processing: ${files.length})`);
  if (newest) console.log(`- newest: ${newest}`);
  console.log(`- force_reprocess: ${forceReprocess}`);
  for (const filePath of files) {
    console.log(`  Â· ${filePath}`);
  }

  const startedAt = Date.now();
  let processed = 0;
  let skipped = 0;
  let reviewRequired = 0;
  let done = 0;
  let metadataOnly = 0;
  let failed = 0;

  try {
    for (const filePath of files) {
      const result = await processRegistryFile(filePath, index, {
        forceReprocess,
        inventoryPolicy: inventoryMap.get(filePath) ?? null,
      });
      if (result.skipped) {
        skipped += 1;
        continue;
      }
      processed += 1;
      if (result.state === 'review_required') reviewRequired += 1;
      if (result.state === 'done') done += 1;
      if (result.state === 'metadata_only') metadataOnly += 1;
      if (result.state === 'failed') failed += 1;
    }

    const stats = index.getPilotStats();
    const elapsedMs = Date.now() - startedAt;
    console.log('Run completed.');
    console.log(`- processed: ${processed}`);
    console.log(`- skipped_dedupe: ${skipped}`);
    console.log(`- review_required: ${reviewRequired}`);
    console.log(`- done: ${done}`);
    console.log(`- metadata_only: ${metadataOnly}`);
    console.log(`- failed: ${failed}`);
    console.log(`- registry_total: ${stats.total}`);
    console.log(`- tax_beleg_count: ${stats.taxBeleg}`);
    console.log(`- elapsed_ms: ${elapsedMs}`);
    console.log(`Next: npm run dil:export-review`);
  } finally {
    index.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error('process-data-inbox failed:', message);
  process.exit(1);
});
