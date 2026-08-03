import fs from 'node:fs/promises';
import { processRegistryFile, walkInboxFiles } from '@/lib/dabos-ops/document-intake/process-registry-file';
import { getRegistryPaths, pathHasExcludedSegment } from '@/lib/dabos-ops/document-intake/registry-config';
import { DIL_CLASSIFY_BATCH_MAX, DIL_REVIEW_UI_BATCH, clampClassifyBatch } from '@/lib/dabos-ops/document-intake/review-config';
import type { DocumentRegistryIndex } from '@/lib/dabos-ops/document-intake/registry-sqlite';
import type { ProcessingState } from '@/lib/dabos-ops/document-intake/types';

export interface InboxBatchResult {
  limit: number;
  candidates: number;
  processed: number;
  skipped: number;
  reviewRequired: number;
  done: number;
  metadataOnly: number;
  failed: number;
  elapsedMs: number;
  files: string[];
}

/** Skip huge files (Node read limit ~2 GiB; also impractical for OCR batch). */
const MAX_INBOX_FILE_BYTES = 200 * 1024 * 1024;

async function filterProcessableSizes(filePaths: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const filePath of filePaths) {
    try {
      const st = await fs.stat(filePath);
      if (st.size <= MAX_INBOX_FILE_BYTES) {
        out.push(filePath);
      } else {
        console.log(`- skip_oversize: ${filePath} (${st.size} bytes)`);
      }
    } catch {
      /* ignore missing */
    }
  }
  return out;
}

export async function listUnprocessedInboxFiles(
  index: DocumentRegistryIndex,
  inboxRoot: string
): Promise<string[]> {
  const allFiles = (await walkInboxFiles(inboxRoot)).filter((f) => !pathHasExcludedSegment(f));
  const unprocessed: string[] = [];
  for (const filePath of allFiles) {
    if (!index.hasPath(filePath)) {
      unprocessed.push(filePath);
    }
  }
  return filterProcessableSizes(unprocessed);
}

export async function processUnprocessedInboxBatch(
  index: DocumentRegistryIndex,
  options: { limit?: number; inboxRoot?: string; inventoryPolicyForPath?: (path: string) => string | null } = {}
): Promise<InboxBatchResult> {
  const paths = getRegistryPaths();
  const inboxRoot = options.inboxRoot ?? paths.inboxRoot;
  const limit = clampClassifyBatch(options.limit ?? DIL_REVIEW_UI_BATCH);
  const startedAt = Date.now();

  const unprocessed = await listUnprocessedInboxFiles(index, inboxRoot);
  const batch = unprocessed.slice(0, limit);

  let processed = 0;
  let skipped = 0;
  let reviewRequired = 0;
  let done = 0;
  let metadataOnly = 0;
  let failed = 0;

  for (const filePath of batch) {
    const result = await processRegistryFile(filePath, index, {
      inventoryPolicy: options.inventoryPolicyForPath?.(filePath) ?? null,
    });
    if (result.skipped) {
      skipped += 1;
      continue;
    }
    processed += 1;
    const state: ProcessingState = result.state;
    if (state === 'review_required') reviewRequired += 1;
    if (state === 'done') done += 1;
    if (state === 'metadata_only') metadataOnly += 1;
    if (state === 'failed') failed += 1;
  }

  return {
    limit,
    candidates: unprocessed.length,
    processed,
    skipped,
    reviewRequired,
    done,
    metadataOnly,
    failed,
    elapsedMs: Date.now() - startedAt,
    files: batch,
  };
}
