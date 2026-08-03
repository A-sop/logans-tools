import { previewKindForPath } from '@/lib/dabos-ops/document-intake/review-path-guard';
import { listUnprocessedInboxFiles, processUnprocessedInboxBatch } from '@/lib/dabos-ops/document-intake/process-inbox-batch';
import { DIL_CLASSIFY_BATCH_MAX, DIL_REVIEW_UI_BATCH, clampClassifyBatch, clampReviewBatch } from '@/lib/dabos-ops/document-intake/review-config';
import {
  mergeFilingOverrides,
  parseReviewNotes,
  resolveEffectiveFiling,
} from '@/lib/dabos-ops/document-intake/review-filing';
import type {
  ProcessBatchResult,
  ReviewDecisionPayload,
  ReviewQueueFilter,
  ReviewQueueItem,
  ReviewQueueResponse,
  ReviewStats,
} from '@/lib/dabos-ops/document-intake/review-types';
import { recordFilingLearning, recordNotedIntentLearning, applyLearnedFilingToProposal, parseFilingMetadata } from '@/lib/dabos-ops/document-intake/registry-filing-learn';
import { getRegistryPaths } from '@/lib/dabos-ops/document-intake/registry-config';
import { loadPilotV3IndexSync, type PilotV3Extraction } from '@/lib/dabos-ops/document-intake/pilot-v3-store';
import { DocumentRegistryIndex, type RegistryReviewRow } from '@/lib/dabos-ops/document-intake/registry-sqlite';
import fs from 'node:fs';
import path from 'node:path';

const EXISTENCE_FILTERED: ReviewQueueFilter[] = ['todo', 'admin', 'noted'];

function sourcePathExists(sourcePath: string): boolean {
  try {
    return fs.existsSync(sourcePath);
  } catch {
    return false;
  }
}

function filterRowsByExistingSource(rows: RegistryReviewRow[]): RegistryReviewRow[] {
  return rows.filter((row) => sourcePathExists(row.source_path));
}

/** Paginate todo/noted after dropping rows whose file is gone from disk. */
function listExistingReviewRows(
  index: DocumentRegistryIndex,
  filter: ReviewQueueFilter,
  limit: number | null,
  offset: number
): { rows: RegistryReviewRow[]; total: number } {
  const allRows = index.listReviewQueue(filter);
  const existing = filterRowsByExistingSource(allRows);
  const safeOffset = Math.max(0, Math.floor(offset));
  const slice = limit && limit > 0 ? existing.slice(safeOffset, safeOffset + limit) : existing.slice(safeOffset);
  return { rows: slice, total: existing.length };
}

function parseWarnings(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return raw ? [raw] : [];
  }
}

function normalizeApproval(raw: string): ReviewQueueItem['approved'] {
  const value = (raw ?? 'pending').trim();
  if (value === 'Y' || value === 'N' || value === 'L' || value === 'flag') return value;
  return 'pending';
}

function normalizePathKey(sourcePath: string): string {
  return sourcePath.replace(/\//g, '\\').toLowerCase();
}

function weakRegistryRename(row: RegistryReviewRow, proposedBasename: string): boolean {
  const current = row.current_filename.trim();
  const proposed = proposedBasename.trim();
  if (!proposed || proposed === current) return true;
  if (proposed.toLowerCase() === current.toLowerCase()) return true;
  if (row.naming_confidence < 0.55) return true;
  return false;
}

function applyV3RenameProposal(
  row: RegistryReviewRow,
  proposedBasename: string,
  proposedRelativePath: string,
  v3: PilotV3Extraction | undefined
): { basename: string; relativePath: string; applied: boolean } {
  if (!v3?.proposal) {
    return { basename: proposedBasename, relativePath: proposedRelativePath, applied: false };
  }

  const v3Basename = path.basename(v3.proposal);
  if (!v3Basename) {
    return { basename: proposedBasename, relativePath: proposedRelativePath, applied: false };
  }

  const folder = path.dirname(proposedRelativePath.replace(/\//g, '\\'));
  const relativePath = path.join(folder, v3Basename).replace(/\//g, '\\');
  const applied = v3Basename !== proposedBasename;
  return { basename: v3Basename, relativePath, applied };
}

function getDisplayProposal(
  row: RegistryReviewRow,
  index: DocumentRegistryIndex,
  v3Index?: Map<string, PilotV3Extraction>
): { displayBasename: string; displayRelativePath: string } {
  const metadata = parseFilingMetadata(row.classification_json, row.doc_role, row.naming_track);
  const learnedProposal = applyLearnedFilingToProposal(
    index,
    row.source_path,
    row.proposed_basename,
    row.proposed_relative_path,
    metadata
  );

  const proposedBasename = learnedProposal.fromRule ? learnedProposal.basename : row.proposed_basename;
  const proposedRelativePath = learnedProposal.fromRule ? learnedProposal.relativePath : row.proposed_relative_path;
  const v3 = v3Index?.get(normalizePathKey(row.source_path));
  const v3Applied = applyV3RenameProposal(row, proposedBasename, proposedRelativePath, v3);

  return {
    displayBasename: v3Applied.applied ? v3Applied.basename : proposedBasename,
    displayRelativePath: v3Applied.applied ? v3Applied.relativePath : proposedRelativePath,
  };
}

function rowToItem(
  row: RegistryReviewRow,
  index: DocumentRegistryIndex,
  v3Index?: Map<string, PilotV3Extraction>
): ReviewQueueItem {
  const metadata = parseFilingMetadata(row.classification_json, row.doc_role, row.naming_track);
  const learnedProposal = applyLearnedFilingToProposal(
    index,
    row.source_path,
    row.proposed_basename,
    row.proposed_relative_path,
    metadata
  );

  const proposedBasename = learnedProposal.fromRule ? learnedProposal.basename : row.proposed_basename;
  const proposedRelativePath = learnedProposal.fromRule ? learnedProposal.relativePath : row.proposed_relative_path;
  const registryProposedBasename = proposedBasename;

  const v3 = v3Index?.get(normalizePathKey(row.source_path));
  const v3Applied = applyV3RenameProposal(row, proposedBasename, proposedRelativePath, v3);
  const displayBasename = v3Applied.applied ? v3Applied.basename : proposedBasename;
  const displayRelativePath = v3Applied.applied ? v3Applied.relativePath : proposedRelativePath;

  const warnings = parseWarnings(row.warnings);
  if (!v3?.proposal && weakRegistryRename(row, registryProposedBasename)) {
    warnings.push(
      'Registry rename is weak (often same as current filename). Riff in Notes or expand v3 pilot coverage.'
    );
  } else if (v3Applied.applied) {
    const taxSweep = v3?.method === 'tax-admin-sweep';
    warnings.push(
      taxSweep
        ? 'Proposed name from tax admin sweep (2025 learnings + index). Verify GW/PR Zeile before approve.'
        : 'Proposed name from v3 pilot (ledger + extraction learnings). Original and registry names kept below for comparison.'
    );
  } else if (v3?.proposal && !v3Applied.applied) {
    warnings.push('v3 pilot proposal matches registry â€” no upgrade needed.');
  } else if (v3 && !v3.proposal && (v3.chars ?? 0) > 0) {
    warnings.push(
      `v3 pilot OCR'd this file (${v3.chars} chars) but could not build a validated rename â€” see partial fields in v3 panel.`
    );
  }

  const merged = mergeFilingOverrides(row.review_notes, row.source_path, displayBasename, displayRelativePath, {
    keepFilename: row.review_keep_filename === 1,
    basenameOverride: row.review_basename_override,
    relativePathOverride: row.review_relative_path_override,
  });

  const parsedNotes = parseReviewNotes(row.review_notes ?? '', row.current_filename);
  if (parsedNotes.inferredDelete) {
    warnings.push('Notes say delete â€” approve N (reject) and remove the file when ready.');
  }
  if (parsedNotes.inferredVentures && !merged.relativePathOverride) {
    warnings.push('Notes mention Ventures / Bridge Life â€” add path: in notes or set folder override before approve.');
  }

  const effective = resolveEffectiveFiling({
    sourcePath: row.source_path,
    proposedBasename: displayBasename,
    proposedRelativePath: displayRelativePath,
    keepFilename: merged.keepFilename,
    basenameOverride: merged.basenameOverride,
    relativePathOverride: merged.relativePathOverride,
  });

  const approval = normalizeApproval(row.approved);
  const hasDraftIntent =
    approval === 'pending' &&
    (effective.usedOverride ||
      Boolean(merged.basenameOverride) ||
      Boolean(merged.relativePathOverride) ||
      merged.keepFilename);

  return {
    sourcePath: row.source_path,
    currentFilename: row.current_filename,
    displayTitle: row.display_title,
    summary: row.summary ?? '',
    docRole: row.doc_role,
    proposedBucket: row.proposed_bucket,
    proposedRelativePath: displayRelativePath,
    proposedBasename: displayBasename,
    namingTrack: row.naming_track,
    confidence: row.confidence,
    namingConfidence: row.naming_confidence,
    warnings,
    lifecycleStatus: row.lifecycle_status,
    approved: normalizeApproval(row.approved),
    reviewNotes: row.review_notes ?? '',
    detectedType: row.detected_type ?? 'unknown',
    previewKind: previewKindForPath(row.source_path),
    keepFilename: merged.keepFilename,
    basenameOverride: merged.basenameOverride,
    relativePathOverride: merged.relativePathOverride,
    effectiveBasename: effective.basename,
    effectiveRelativePath: effective.relativePath,
    hasLearnedRule: learnedProposal.fromRule,
    learnedRuleLabel: learnedProposal.ruleLabel,
    hasDraftIntent,
    v3AppliedRename: v3Applied.applied,
    registryProposedBasename,
  };
}

function withIndex<T>(fn: (index: DocumentRegistryIndex) => T): T {
  const paths = getRegistryPaths();
  const index = new DocumentRegistryIndex(paths.registryDbPath);
  try {
    return fn(index);
  } finally {
    index.close();
  }
}

async function withIndexAsync<T>(fn: (index: DocumentRegistryIndex) => Promise<T>): Promise<T> {
  const paths = getRegistryPaths();
  const index = new DocumentRegistryIndex(paths.registryDbPath);
  try {
    return await fn(index);
  } finally {
    index.close();
  }
}

/** Server-side review adapter â€” swap this module to change backend without touching the UI. */
export async function getReviewStats(options: { includeInboxWalk?: boolean } = {}): Promise<ReviewStats> {
  return withIndexAsync(async (index) => {
    const stats = index.getReviewDecisionStats();
    const filingRules = index.listFilingRules().length;
    const paths = getRegistryPaths();
    const unprocessedInbox = options.includeInboxWalk
      ? (await listUnprocessedInboxFiles(index, paths.inboxRoot)).length
      : -1;
    const projectDecided = stats.yes + stats.no + stats.flag;
    const reviewScope = stats.todo + stats.later + projectDecided;
    const projectPercent =
      reviewScope > 0 ? Math.min(100, Math.round((projectDecided / reviewScope) * 100)) : projectDecided > 0 ? 100 : 0;
    const decidedToday = index.countDecidedTodayLocal();
    return {
      ...stats,
      filingRules,
      unprocessedInbox: unprocessedInbox < 0 ? stats.todo : unprocessedInbox,
      reviewScope,
      projectDecided,
      projectPercent,
      decidedToday,
    };
  });
}

export function listReviewQueuePage(
  filter: ReviewQueueFilter = 'todo',
  limit?: number | null,
  offset = 0
): ReviewQueueResponse {
  return withIndex((index) => {
    const v3Index = loadPilotV3IndexSync();
    const effectiveLimit = limit && limit > 0 ? limit : null;
    const safeOffset = Math.max(0, Math.floor(offset));

    if (EXISTENCE_FILTERED.includes(filter)) {
      const { rows, total } = listExistingReviewRows(index, filter, effectiveLimit, safeOffset);
      const hasMore = effectiveLimit ? safeOffset + rows.length < total : false;
      return {
        items: rows.map((row) => rowToItem(row, index, v3Index)),
        total,
        showing: rows.length,
        limit: effectiveLimit,
        offset: safeOffset,
        hasMore,
        instant: true,
      };
    }

    const total = index.countReviewQueue(filter);
    const rows = index.listReviewQueue(filter, effectiveLimit ?? undefined, safeOffset);
    const hasMore = effectiveLimit ? safeOffset + rows.length < total : false;
    return {
      items: rows.map((row) => rowToItem(row, index, v3Index)),
      total,
      showing: rows.length,
      limit: effectiveLimit,
      offset: safeOffset,
      hasMore,
      instant: true,
    };
  });
}

export function getReviewItem(sourcePath: string): ReviewQueueItem | null {
  return withIndex((index) => {
    const row = index.getReviewEntry(sourcePath);
    return row ? rowToItem(row, index, loadPilotV3IndexSync()) : null;
  });
}

export function saveReviewDecision(payload: ReviewDecisionPayload): ReviewQueueItem | null {
  return withIndex((index) => {
    const row = index.getReviewEntry(payload.sourcePath);
    if (!row) return null;

    const v3Index = loadPilotV3IndexSync();
    const { displayBasename, displayRelativePath } = getDisplayProposal(row, index, v3Index);

    const notes = payload.reviewNotes ?? row.review_notes ?? '';
    const merged = mergeFilingOverrides(notes, row.source_path, displayBasename, displayRelativePath, {
      keepFilename: payload.keepFilename === true ? true : undefined,
      basenameOverride: payload.basenameOverride?.trim() || undefined,
      relativePathOverride: payload.relativePathOverride?.trim() || undefined,
    });

    index.updateReviewDecision(payload.sourcePath, payload.approved, notes, merged);

    const resolved = resolveEffectiveFiling({
      sourcePath: row.source_path,
      proposedBasename: displayBasename,
      proposedRelativePath: displayRelativePath,
      keepFilename: merged.keepFilename,
      basenameOverride: merged.basenameOverride,
      relativePathOverride: merged.relativePathOverride,
    });

    const learningInput = {
      sourcePath: row.source_path,
      currentFilename: row.current_filename,
      approved: payload.approved,
      reviewNotes: notes,
      resolved,
      metadata: parseFilingMetadata(row.classification_json, row.doc_role, row.naming_track),
    };

    recordNotedIntentLearning(index, learningInput);
    recordFilingLearning(index, learningInput);

    const updated = index.getReviewEntry(payload.sourcePath);
    return updated ? rowToItem(updated, index, v3Index) : null;
  });
}

export async function processInboxBatch(limit = DIL_REVIEW_UI_BATCH): Promise<ProcessBatchResult> {
  return withIndexAsync(async (index) => {
    const result = await processUnprocessedInboxBatch(index, { limit: clampClassifyBatch(limit) });
    return {
      limit: result.limit,
      candidates: result.candidates,
      processed: result.processed,
      skipped: result.skipped,
      reviewRequired: result.reviewRequired,
      done: result.done,
      metadataOnly: result.metadataOnly,
      failed: result.failed,
      elapsedMs: result.elapsedMs,
    };
  });
}

export { parseReviewNotes, mergeFilingOverrides, resolveEffectiveFiling };
