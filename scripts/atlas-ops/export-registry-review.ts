#!/usr/bin/env npx tsx
import * as fs from 'fs/promises';
import { getRegistryPaths } from '@/lib/atlas-ops/document-intake/registry-config';
import { DocumentRegistryIndex } from '@/lib/atlas-ops/document-intake/registry-sqlite';

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const includeAll = args.includes('--all');

  const paths = getRegistryPaths();
  const index = new DocumentRegistryIndex(paths.registryDbPath);

  try {
    const rows = includeAll ? index.listAllEntries() : index.listForReviewExport('review_required');
    const header = [
      'source_path',
      'current_filename',
      'display_title',
      'summary',
      'doc_role',
      'proposed_bucket',
      'proposed_relative_path',
      'proposed_basename',
      'naming_track',
      'confidence',
      'naming_confidence',
      'warnings',
      'lifecycle_status',
      'approved',
      'review_notes',
    ];

    const lines = [
      header.join(','),
      ...rows.map((row) =>
        [
          row.source_path,
          row.current_filename,
          row.display_title,
          row.summary ?? '',
          row.doc_role,
          row.proposed_bucket,
          row.proposed_relative_path,
          row.proposed_basename,
          row.naming_track,
          String(row.confidence),
          String(row.naming_confidence),
          row.warnings,
          row.lifecycle_status,
          row.approved || 'pending',
          row.review_notes ?? '',
        ]
          .map((v) => csvEscape(String(v ?? '')))
          .join(',')
      ),
    ];

    await fs.mkdir(paths.manifestsDir, { recursive: true });
    await fs.writeFile(paths.reviewCsvPath, lines.join('\n'), 'utf8');

    console.log(`Exported ${rows.length} row(s) to:`);
    console.log(paths.reviewCsvPath);
    console.log('Prefer visual review: npm run dil:review → http://localhost:3847/dil/review');
    console.log('CSV fallback — approved: Y | N | L | flag');
    console.log('Then: npm run dil:apply -- --import-csv (after filling approved column)');
  } finally {
    index.close();
  }
}

main().catch((error: unknown) => {
  console.error('export-registry-review failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
