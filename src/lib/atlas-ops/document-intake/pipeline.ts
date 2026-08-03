import * as fs from 'fs/promises';
import * as path from 'path';
import {
  isAutoPromoteEnabled,
  isLearningEnabled,
  isLlmInterpreterEnabled,
  learnedRulesVersionOverride,
  learningThresholds,
  markdownTextPolicy,
  shouldRunOcrFallback,
} from '@/lib/atlas-ops/document-intake/config';
import { classifyExtractedText } from '@/lib/atlas-ops/document-intake/classify';
import { extractTextFromImage } from '@/lib/atlas-ops/document-intake/extractors/image';
import { extractTextFromPdf } from '@/lib/atlas-ops/document-intake/extractors/pdf';
import { SqliteDocumentIndex } from '@/lib/atlas-ops/document-intake/index-sqlite';
import { runThresholdPromotion } from '@/lib/atlas-ops/document-intake/learning-evaluator';
import { generateCandidateRulesFromAcceptedOutcomes } from '@/lib/atlas-ops/document-intake/learning-learner';
import { applyLearnedRulesToClassification } from '@/lib/atlas-ops/document-intake/learning-runtime';
import { maybeInterpretWithLlm } from '@/lib/atlas-ops/document-intake/llm-interpreter';
import { createDocumentMarkdown } from '@/lib/atlas-ops/document-intake/markdown';
import { buildDocumentNaming } from '@/lib/atlas-ops/document-intake/naming';
import { detectFileRouting } from '@/lib/atlas-ops/document-intake/router';
import { computeFileSha256, ensurePipelineDirectories, moveToFailed, moveToProcessed, writeMarkdown } from '@/lib/atlas-ops/document-intake/storage';
import type {
  ExtractionResult,
  PipelinePaths,
  ProcessInboxResult,
  ProcessOptions,
  ProcessSingleFileResult,
  ProcessingState,
} from '@/lib/atlas-ops/document-intake/types';

function shouldMarkReviewRequired(confidence: number, warnings: string[]): boolean {
  if (confidence < 0.65) return true;
  return warnings.length > 0;
}

async function extractByKind(filePath: string, kind: 'pdf' | 'image'): Promise<ExtractionResult> {
  if (kind === 'pdf') {
    return extractTextFromPdf(filePath, shouldRunOcrFallback());
  }
  return extractTextFromImage(filePath);
}

function determineLifecycleStatus(confidence: number, warnings: string[]): ProcessingState {
  if (shouldMarkReviewRequired(confidence, warnings)) return 'review_required';
  return 'done';
}

function parseEntryNames(entries: Array<{ name: string; isFile: () => boolean }>): string[] {
  return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
}

export async function processSingleInboxFile(
  sourcePath: string,
  paths: PipelinePaths,
  index: SqliteDocumentIndex,
  options: ProcessOptions = {}
): Promise<ProcessSingleFileResult> {
  const sourceFileName = path.basename(sourcePath);
  const fileHash = await computeFileSha256(sourcePath);

  if (!options.forceReprocess && index.hasHash(fileHash)) {
    return {
      state: 'done',
      sourcePath,
      warningCount: 0,
    };
  }

  const routing = await detectFileRouting(sourcePath);
  if (!routing.isSupported) {
    const failedPath = await moveToFailed(sourcePath, paths.failed);
    index.upsertDocument({
      sourceFileName,
      sourcePath,
      processedFileName: path.basename(failedPath),
      processedPath: failedPath,
      markdownPath: '',
      fileHash,
      mimeType: routing.mimeType,
      detectedType: 'unsupported',
      lifecycleStatus: 'failed',
      classificationJson: JSON.stringify({}),
      confidence: 0,
      warningsJson: JSON.stringify(['Unsupported file type.']),
      errorMessage: 'Unsupported file type',
      processedAtIso: new Date().toISOString(),
    });

    return {
      state: 'failed',
      sourcePath,
      processedPath: failedPath,
      warningCount: 1,
      error: 'Unsupported file type',
    };
  }

  const extractKind = routing.kind;
  if (extractKind !== 'pdf' && extractKind !== 'image') {
    throw new Error(`Unexpected document kind after routing: ${extractKind}`);
  }

  try {
    const extraction = await extractByKind(sourcePath, extractKind);
    const baselineClassification = classifyExtractedText(extraction.extractedText);
    const llmClassification = await maybeInterpretWithLlm(
      extraction.extractedText,
      baselineClassification,
      isLlmInterpreterEnabled()
    );
    let classification =
      llmClassification && llmClassification.confidence >= baselineClassification.confidence
        ? llmClassification
        : baselineClassification;

    if (isLearningEnabled()) {
      const withLearnedRules = applyLearnedRulesToClassification(
        index,
        classification,
        learnedRulesVersionOverride()
      );
      classification = withLearnedRules.classification;
    }

    const naming = buildDocumentNaming(classification, sourcePath);

    const processedPath = await moveToProcessed(
      sourcePath,
      // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal -- naming.finalFileName from pipeline naming helpers under configured processed dir
      path.join(paths.processed, naming.finalFileName)
    );

    const warnings = [...extraction.warnings, ...classification.warnings];
    const lifecycleStatus = determineLifecycleStatus(classification.confidence, warnings);
    const markdownText = createDocumentMarkdown({
      originalFileName: sourceFileName,
      finalFileName: path.basename(processedPath),
      routing,
      classification,
      extractedText: extraction.extractedText,
      includeFullText: markdownTextPolicy() === 'full',
      warnings,
    });

    const markdownPath = await writeMarkdown(
      // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal -- markdown under configured markdown dir
      path.join(paths.markdown, naming.markdownFileName),
      markdownText
    );

    index.upsertDocument({
      sourceFileName,
      sourcePath,
      processedFileName: path.basename(processedPath),
      processedPath,
      markdownPath,
      fileHash,
      mimeType: routing.mimeType,
      detectedType: routing.kind,
      lifecycleStatus,
      classificationJson: JSON.stringify(classification),
      confidence: classification.confidence,
      warningsJson: JSON.stringify(warnings),
      errorMessage: null,
      processedAtIso: new Date().toISOString(),
    });

    return {
      state: lifecycleStatus,
      sourcePath,
      processedPath,
      markdownPath,
      warningCount: warnings.length,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown processing error';
    const failedPath = await moveToFailed(sourcePath, paths.failed);
    index.upsertDocument({
      sourceFileName,
      sourcePath,
      processedFileName: path.basename(failedPath),
      processedPath: failedPath,
      markdownPath: '',
      fileHash,
      mimeType: 'application/octet-stream',
      detectedType: 'unsupported',
      lifecycleStatus: 'failed',
      classificationJson: JSON.stringify({}),
      confidence: 0,
      warningsJson: JSON.stringify([]),
      errorMessage,
      processedAtIso: new Date().toISOString(),
    });

    return {
      state: 'failed',
      sourcePath,
      processedPath: failedPath,
      warningCount: 0,
      error: errorMessage,
    };
  }
}

export async function processInbox(
  paths: PipelinePaths,
  options: ProcessOptions = {}
): Promise<ProcessInboxResult> {
  await ensurePipelineDirectories(paths);
  const index = new SqliteDocumentIndex(paths.sqliteDbPath);

  try {
    const entries = await fs.readdir(paths.inbox, { withFileTypes: true });
    const fileNames = parseEntryNames(entries);
    let processedCount = 0;
    let reviewRequiredCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const fileName of fileNames) {
      // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal -- inbox listing from configured inbox root only
      const sourcePath = path.join(paths.inbox, fileName);
      const result = await processSingleInboxFile(sourcePath, paths, index, options);

      if (!result.processedPath && result.state === 'done') {
        skippedCount += 1;
        continue;
      }

      if (result.state === 'done') processedCount += 1;
      if (result.state === 'review_required') reviewRequiredCount += 1;
      if (result.state === 'failed') failedCount += 1;
    }

    const result: ProcessInboxResult = {
      scannedCount: fileNames.length,
      processedCount,
      reviewRequiredCount,
      failedCount,
      skippedCount,
    };

    if (isLearningEnabled()) {
      const learningStats = generateCandidateRulesFromAcceptedOutcomes(index);
      const promotionStats = runThresholdPromotion(
        index,
        learningThresholds(),
        isAutoPromoteEnabled()
      );
      result.learning = {
        candidateCount: learningStats.candidateCount,
        updatedCount: learningStats.updatedCount,
        promotedCount: promotionStats.promotedCount,
        rejectedCount: promotionStats.rejectedCount,
        promotedRuleVersion: promotionStats.promotedRuleVersion,
      };
    }

    return result;
  } finally {
    index.close();
  }
}
