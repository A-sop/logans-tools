/** UI/API contract for DIL review — backend-agnostic so the workbench can swap adapters later. */

export type ReviewApproval = 'pending' | 'Y' | 'N' | 'L' | 'flag';

export type ReviewQueueFilter = 'todo' | 'admin' | 'later' | 'noted' | 'decided' | 'all';

export interface ReviewQueueItem {
  sourcePath: string;
  currentFilename: string;
  displayTitle: string;
  summary: string;
  docRole: string;
  proposedBucket: string;
  proposedRelativePath: string;
  proposedBasename: string;
  namingTrack: string;
  confidence: number;
  namingConfidence: number;
  warnings: string[];
  lifecycleStatus: string;
  approved: ReviewApproval;
  reviewNotes: string;
  detectedType: string;
  previewKind: 'pdf' | 'image' | 'none';
  keepFilename: boolean;
  basenameOverride: string;
  relativePathOverride: string;
  effectiveBasename: string;
  effectiveRelativePath: string;
  hasLearnedRule: boolean;
  learnedRuleLabel: string | null;
  /** Notes parsed to name/path intent while still pending (not yet Y). */
  hasDraftIntent: boolean;
  /** When v3 pilot supplied a stronger rename than stage-1 registry. */
  v3AppliedRename: boolean;
  registryProposedBasename: string;
}

export interface ReviewStats {
  todo: number;
  /** Pre-admin pending rows with review notes (riffed, not yet Y/N/L). */
  noted: number;
  later: number;
  yes: number;
  no: number;
  flag: number;
  total: number;
  /** review_required + pending under 20_ADMIN (phase 2 — frozen moves). */
  admin: number;
  filingRules: number;
  unprocessedInbox: number;
  reviewScope: number;
  projectDecided: number;
  projectPercent: number;
  decidedToday: number;
}

export interface ReviewQueueResponse {
  items: ReviewQueueItem[];
  total: number;
  showing: number;
  limit: number | null;
  offset: number;
  hasMore: boolean;
  /** True when this page is a cheap registry read (no OCR). */
  instant: boolean;
}

export interface ProcessBatchResult {
  limit: number;
  candidates: number;
  processed: number;
  skipped: number;
  reviewRequired: number;
  done: number;
  metadataOnly: number;
  failed: number;
  elapsedMs: number;
}

export interface ReviewDecisionPayload {
  sourcePath: string;
  approved: ReviewApproval;
  reviewNotes?: string;
  keepFilename?: boolean;
  basenameOverride?: string;
  relativePathOverride?: string;
}
