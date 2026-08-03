#!/usr/bin/env npx tsx
import { getIntakePreflight, getPipelinePaths } from '@/lib/atlas-ops/document-intake/config';

async function main(): Promise<void> {
  const paths = getPipelinePaths();
  const preflight = getIntakePreflight(paths);

  console.log('Document intake preflight');
  console.log(`- root: ${preflight.rootPath}`);
  console.log(`- ocr_enabled: ${preflight.ocrEnabled}`);
  console.log(`- llm_enabled: ${preflight.llmEnabled}`);
  console.log(`- llm_credentials_present: ${preflight.llmCredentialsPresent}`);
  console.log(`- learning_enabled: ${preflight.learningEnabled}`);
  console.log(`- auto_promote_enabled: ${preflight.autoPromoteEnabled}`);

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
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error('Preflight failed:', message);
  process.exit(1);
});
