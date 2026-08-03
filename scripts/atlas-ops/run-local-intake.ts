#!/usr/bin/env npx tsx
import { getIntakePreflight, getPipelinePaths } from '@/lib/atlas-ops/document-intake/config';
import { processInbox } from '@/lib/atlas-ops/document-intake/pipeline';
import { ensurePipelineDirectories } from '@/lib/atlas-ops/document-intake/storage';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const ensureOnly = args.includes('--ensure-only');
  const forceReprocess = args.includes('--force-reprocess');

  const paths = getPipelinePaths();
  const preflight = getIntakePreflight(paths);
  await ensurePipelineDirectories(paths);

  if (ensureOnly) {
    console.log('Document intake folders ensured:');
    console.log(`- root: ${paths.root}`);
    console.log(`- inbox: ${paths.inbox}`);
    console.log(`- processed: ${paths.processed}`);
    console.log(`- markdown: ${paths.markdown}`);
    console.log(`- failed: ${paths.failed}`);
    console.log(`- sqlite: ${paths.sqliteDbPath}`);
    console.log('- mode:');
    console.log(`  - ocr_enabled: ${preflight.ocrEnabled}`);
    console.log(`  - llm_enabled: ${preflight.llmEnabled}`);
    console.log(`  - llm_credentials_present: ${preflight.llmCredentialsPresent}`);
    console.log(`  - learning_enabled: ${preflight.learningEnabled}`);
    console.log(`  - auto_promote_enabled: ${preflight.autoPromoteEnabled}`);
    return;
  }

  console.log('Intake preflight:');
  console.log(`- root: ${preflight.rootPath}`);
  console.log(`- ocr_enabled: ${preflight.ocrEnabled}`);
  console.log(`- ocr_engine: ${preflight.ocrEngine}`);
  console.log(`- llm_enabled: ${preflight.llmEnabled}`);
  console.log(`- llm_credentials_present: ${preflight.llmCredentialsPresent}`);
  console.log(`- learning_enabled: ${preflight.learningEnabled}`);
  console.log(`- auto_promote_enabled: ${preflight.autoPromoteEnabled}`);
  console.log(`- force_reprocess: ${forceReprocess}`);

  if (!preflight.ocrEnabled) {
    console.log(
      '- warning: OCR fallback is disabled. Scanned PDFs may produce UnknownOrg/UnknownPerson.'
    );
  }
  if (preflight.llmEnabled && !preflight.llmCredentialsPresent) {
    console.log(
      '- warning: LLM is enabled but no credentials/base URL detected. Semantic enrichment will be skipped.'
    );
  }
  if (!preflight.llmEnabled) {
    console.log(
      '- note: Running in local deterministic mode (no LLM). This is expected if no LLM credentials are configured.'
    );
  }

  const startedAt = Date.now();
  const report = await processInbox(paths, { forceReprocess });
  const elapsedMs = Date.now() - startedAt;

  console.log('Local document intake run completed.');
  console.log(`- scanned: ${report.scannedCount}`);
  console.log(`- processed: ${report.processedCount}`);
  console.log(`- review_required: ${report.reviewRequiredCount}`);
  console.log(`- failed: ${report.failedCount}`);
  console.log(`- skipped: ${report.skippedCount}`);
  if (report.learning) {
    console.log('- learning:');
    console.log(`  - candidate_count: ${report.learning.candidateCount}`);
    console.log(`  - updated_count: ${report.learning.updatedCount}`);
    console.log(`  - promoted_count: ${report.learning.promotedCount}`);
    console.log(`  - rejected_count: ${report.learning.rejectedCount}`);
    console.log(`  - promoted_rule_version: ${report.learning.promotedRuleVersion}`);
  }
  console.log(`- elapsed_ms: ${elapsedMs}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error('Document intake run failed:', message);
  process.exit(1);
});
