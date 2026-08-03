#!/usr/bin/env npx tsx
/**
 * Parse review notes on approved rows and persist filing overrides + learned rules.
 * Safe to re-run (idempotent merge from notes).
 */
import { parseFilingMetadata, recordFilingLearning } from '@/lib/atlas-ops/document-intake/registry-filing-learn';
import { mergeFilingOverrides, resolveEffectiveFiling } from '@/lib/atlas-ops/document-intake/review-filing';
import { getRegistryPaths } from '@/lib/atlas-ops/document-intake/registry-config';
import { DocumentRegistryIndex } from '@/lib/atlas-ops/document-intake/registry-sqlite';

async function main(): Promise<void> {
  const paths = getRegistryPaths();
  const index = new DocumentRegistryIndex(paths.registryDbPath);

  try {
    const rows = index.listAllEntries().filter((row) => row.approved === 'Y');
    let updated = 0;
    let learned = 0;

    for (const row of rows) {
      const merged = mergeFilingOverrides(
        row.review_notes,
        row.source_path,
        row.proposed_basename,
        row.proposed_relative_path
      );

      const hasExplicit =
        merged.keepFilename ||
        merged.basenameOverride.length > 0 ||
        merged.relativePathOverride.length > 0 ||
        row.review_notes.trim().length > 0;

      if (!hasExplicit) continue;

      index.updateReviewDecision(row.source_path, 'Y', row.review_notes, merged);
      updated += 1;

      const resolved = resolveEffectiveFiling({
        sourcePath: row.source_path,
        proposedBasename: row.proposed_basename,
        proposedRelativePath: row.proposed_relative_path,
        keepFilename: merged.keepFilename,
        basenameOverride: merged.basenameOverride,
        relativePathOverride: merged.relativePathOverride,
      });

      recordFilingLearning(index, {
        sourcePath: row.source_path,
        currentFilename: row.current_filename,
        approved: 'Y',
        reviewNotes: row.review_notes,
        resolved,
        metadata: parseFilingMetadata(row.classification_json, row.doc_role, row.naming_track),
      });
      learned += 1;

      console.log(`${row.current_filename}`);
      console.log(`  -> ${resolved.relativePath}`);
    }

    console.log(`Backfill complete: ${updated} row(s) updated, ${learned} learning rule(s) recorded.`);
    console.log(`Total filing rules: ${index.listFilingRules().length}`);
  } finally {
    index.close();
  }
}

main().catch((error: unknown) => {
  console.error('backfill-review-filing failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
