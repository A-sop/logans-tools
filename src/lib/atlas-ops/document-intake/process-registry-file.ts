import * as fs from 'fs/promises';
import * as path from 'path';
import { classifyExtractedText } from '@/lib/atlas-ops/document-intake/classify';
import { shouldRunOcrFallback, isLlmInterpreterEnabled } from '@/lib/atlas-ops/document-intake/config';
import { enrichClassification, metadataOnlyClassification } from '@/lib/atlas-ops/document-intake/enrich-classification';
import { applyLearnedFilingToProposal } from '@/lib/atlas-ops/document-intake/registry-filing-learn';
import { extractTextFromImage } from '@/lib/atlas-ops/document-intake/extractors/image';
import { extractTextFromPdf } from '@/lib/atlas-ops/document-intake/extractors/pdf';
import { maybeInterpretWithLlm } from '@/lib/atlas-ops/document-intake/llm-interpreter';
import type { DocumentRegistryIndex, RegistryEntryRecord } from '@/lib/atlas-ops/document-intake/registry-sqlite';
import { detectFileRouting } from '@/lib/atlas-ops/document-intake/router';
import { computeFileSha256 } from '@/lib/atlas-ops/document-intake/storage';
import type { ProcessingState, RegistryClassification } from '@/lib/atlas-ops/document-intake/types';

const TAX_ZEILE_CONFIDENCE_THRESHOLD = 0.6;
const REVIEW_CONFIDENCE_THRESHOLD = 0.65;

function determineLifecycleStatus(
  confidence: number,
  warnings: string[],
  detectedType: string,
  namingTrack: string,
  namingConfidence: number
): ProcessingState {
  if (detectedType === 'unsupported') return 'metadata_only';
  if (namingTrack === 'tax_beleg' && namingConfidence < TAX_ZEILE_CONFIDENCE_THRESHOLD) {
    return 'review_required';
  }
  if (confidence < REVIEW_CONFIDENCE_THRESHOLD || warnings.length > 0) return 'review_required';
  return 'done';
}

function applyLearnedFiling(registry: RegistryClassification, sourcePath: string, index: DocumentRegistryIndex): void {
  const metadata = {
    docRole: registry.enrichment.docRole,
    namingTrack: registry.enrichment.namingTrack,
    organization: registry.organization,
    anbieter: registry.enrichment.anbieter ?? null,
  };
  const learned = applyLearnedFilingToProposal(
    index,
    sourcePath,
    registry.enrichment.proposedBasename,
    registry.enrichment.proposedRelativePath,
    metadata
  );
  if (!learned.fromRule) return;

  registry.enrichment.proposedBasename = learned.basename;
  registry.enrichment.proposedRelativePath = learned.relativePath;
  const label = learned.ruleLabel ?? 'learned rule';
  registry.warnings.push(`Applied learned filing rule (${label}).`);
}

function entryFromClassification(
  sourcePath: string,
  fileHash: string,
  fileSizeBytes: number,
  mimeType: string,
  detectedType: string,
  registry: RegistryClassification,
  lifecycleStatus: ProcessingState,
  inventoryPolicy: string | null,
  errorMessage: string | null
): RegistryEntryRecord {
  const { enrichment } = registry;
  return {
    sourcePath,
    sourceFileName: path.basename(sourcePath),
    fileHash,
    fileSizeBytes,
    mimeType,
    detectedType,
    lifecycleStatus,
    classificationJson: JSON.stringify(registry),
    confidence: registry.confidence,
    warningsJson: JSON.stringify(registry.warnings),
    docRole: enrichment.docRole,
    proposedBucket: enrichment.proposedBucket,
    proposedRelativePath: enrichment.proposedRelativePath,
    namingTrack: enrichment.namingTrack,
    proposedBasename: enrichment.proposedBasename,
    displayTitle: enrichment.displayTitle,
    namingConfidence: enrichment.namingConfidence,
    approved: 'pending',
    inventoryPolicy,
    errorMessage,
    processedAtIso: new Date().toISOString(),
  };
}

export interface ProcessRegistryFileResult {
  state: ProcessingState;
  sourcePath: string;
  skipped: boolean;
}

export async function processRegistryFile(
  sourcePath: string,
  index: DocumentRegistryIndex,
  options: { forceReprocess?: boolean; inventoryPolicy?: string | null } = {}
): Promise<ProcessRegistryFileResult> {
  const stat = await fs.stat(sourcePath);
  if (!stat.isFile()) {
    return { state: 'failed', sourcePath, skipped: true };
  }

  const fileHash = await computeFileSha256(sourcePath);
  if (!options.forceReprocess && index.hasHash(fileHash)) {
    // Register duplicate paths so the registry knows where every copy lives and
    // unprocessed-batch selection can progress past them. 'done' keeps them out
    // of the review queue; nothing is moved (register-only).
    if (!index.hasPath(sourcePath)) {
      const canonicalPath = index.getFirstPathForHash(fileHash);
      const registry = metadataOnlyClassification(sourcePath);
      registry.warnings.push(
        canonicalPath ? `Duplicate content: canonical copy registered at ${canonicalPath}` : 'Duplicate content.'
      );
      index.upsertEntry(
        entryFromClassification(
          sourcePath,
          fileHash,
          stat.size,
          'application/octet-stream',
          'unsupported',
          registry,
          'done',
          options.inventoryPolicy ?? null,
          null
        )
      );
    }
    return { state: 'done', sourcePath, skipped: true };
  }

  const routing = await detectFileRouting(sourcePath);

  if (!routing.isSupported) {
    const registry = metadataOnlyClassification(sourcePath);
    applyLearnedFiling(registry, sourcePath, index);
    const lifecycleStatus = determineLifecycleStatus(
      registry.confidence,
      registry.warnings,
      'unsupported',
      registry.enrichment.namingTrack,
      registry.enrichment.namingConfidence
    );
    index.upsertEntry(
      entryFromClassification(
        sourcePath,
        fileHash,
        stat.size,
        routing.mimeType,
        'unsupported',
        registry,
        lifecycleStatus,
        options.inventoryPolicy ?? null,
        null
      )
    );
    return { state: lifecycleStatus, sourcePath, skipped: false };
  }

  const extractKind = routing.kind;
  if (extractKind !== 'pdf' && extractKind !== 'image') {
    throw new Error(`Unexpected document kind: ${extractKind}`);
  }

  try {
    const extraction =
      extractKind === 'pdf'
        ? await extractTextFromPdf(sourcePath, shouldRunOcrFallback())
        : await extractTextFromImage(sourcePath);

    const baseline = classifyExtractedText(extraction.extractedText, { sourcePath });
    const llm = await maybeInterpretWithLlm(extraction.extractedText, baseline, isLlmInterpreterEnabled());
    const baseClassification =
      llm && llm.confidence >= baseline.confidence ? llm : baseline;

    const registry = enrichClassification(baseClassification, sourcePath, extraction.extractedText);
    applyLearnedFiling(registry, sourcePath, index);
    const allWarnings = [...extraction.warnings, ...registry.warnings];
    registry.warnings = allWarnings;

    const lifecycleStatus = determineLifecycleStatus(
      registry.confidence,
      allWarnings,
      routing.kind,
      registry.enrichment.namingTrack,
      registry.enrichment.namingConfidence
    );

    index.upsertEntry(
      entryFromClassification(
        sourcePath,
        fileHash,
        stat.size,
        routing.mimeType,
        routing.kind,
        registry,
        lifecycleStatus,
        options.inventoryPolicy ?? null,
        null
      )
    );

    return { state: lifecycleStatus, sourcePath, skipped: false };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown processing error';
    const registry = metadataOnlyClassification(sourcePath);
    registry.warnings.push(errorMessage);
    index.upsertEntry(
      entryFromClassification(
        sourcePath,
        fileHash,
        stat.size,
        'application/octet-stream',
        'unsupported',
        registry,
        'failed',
        options.inventoryPolicy ?? null,
        errorMessage
      )
    );
    return { state: 'failed', sourcePath, skipped: false };
  }
}

export async function walkInboxFiles(inboxRoot: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal -- recursive walk under known inboxRoot
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        results.push(full);
      }
    }
  }

  await walk(inboxRoot);
  return results.sort();
}
