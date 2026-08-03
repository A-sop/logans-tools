import type {

  ProcessBatchResult,

  ReviewDecisionPayload,

  ReviewQueueFilter,

  ReviewQueueItem,

  ReviewQueueResponse,

  ReviewStats,

} from '@/lib/dabos-ops/document-intake/review-types';

import {

  DIL_CLASSIFY_BATCH_MAX,

  DIL_REVIEW_UI_BATCH,

  clampClassifyBatch,

  clampReviewBatch,

} from '@/lib/dabos-ops/document-intake/review-config';



/** Browser client â€” talks only to /api/dil/review/* so the backend can be replaced later. */



const API_BASE = '/api/dabos/dil/review';



async function parseJson<T>(response: Response): Promise<T> {

  if (!response.ok) {

    const body = (await response.json().catch(() => ({}))) as { error?: string };

    throw new Error(body.error ?? `Request failed (${response.status})`);

  }

  return response.json() as Promise<T>;

}



export function filePreviewUrl(sourcePath: string): string {

  return `${API_BASE}/file?path=${encodeURIComponent(sourcePath)}`;

}



export interface PathCompleteResult {

  suggestions: string[];

  tabSuffix: string | null;

}



export async function fetchPathCompletions(query: string): Promise<PathCompleteResult> {

  const response = await fetch(`${API_BASE}/path-complete?q=${encodeURIComponent(query)}`, {

    cache: 'no-store',

  });

  return parseJson<PathCompleteResult>(response);

}



/** Fast counts from registry DB only (default for Reload). */

export async function fetchReviewStats(options: { full?: boolean } = {}): Promise<ReviewStats> {

  const qs = options.full ? '?full=1' : '';

  const response = await fetch(`${API_BASE}/stats${qs}`, { cache: 'no-store' });

  return parseJson<ReviewStats>(response);

}



/** Instant slice from registry â€” never runs OCR. */

export async function fetchReviewQueue(

  filter: ReviewQueueFilter = 'todo',

  limit: number | 'all' = DIL_REVIEW_UI_BATCH,

  offset = 0

): Promise<ReviewQueueResponse> {

  const limitParam = limit === 'all' ? 'all' : String(clampReviewBatch(limit));

  const response = await fetch(

    `${API_BASE}/queue?filter=${encodeURIComponent(filter)}&limit=${limitParam}&offset=${Math.max(0, offset)}`,

    { cache: 'no-store' }

  );

  return parseJson<ReviewQueueResponse>(response);

}



export async function fetchReviewItem(sourcePath: string): Promise<ReviewQueueItem | null> {

  const response = await fetch(`${API_BASE}/item?path=${encodeURIComponent(sourcePath)}`, { cache: 'no-store' });

  if (response.status === 404) return null;

  return parseJson<ReviewQueueItem>(response);

}



export interface PilotV3ExtractionResponse {
  extraction: {
    path: string;
    originalBasename: string | null;
    currentFilename: string | null;
    registryBasename: string | null;
    method: string;
    chars: number;
    proposal: string | null;
    notes: string[];
    runAt: string | null;
    fields: Record<string, { value: string; page?: string; evidence?: string }>;
  } | null;
}



export async function fetchPilotV3Extraction(sourcePath: string): Promise<PilotV3ExtractionResponse> {
  const response = await fetch(`${API_BASE}/v3-extraction?path=${encodeURIComponent(sourcePath)}`, {
    cache: 'no-store',
  });
  return parseJson<PilotV3ExtractionResponse>(response);
}


export async function saveReviewDecision(payload: ReviewDecisionPayload): Promise<ReviewQueueItem> {

  const response = await fetch(`${API_BASE}/decision`, {

    method: 'POST',

    headers: { 'Content-Type': 'application/json' },

    body: JSON.stringify(payload),

  });

  return parseJson<ReviewQueueItem>(response);

}



/** Slow: OCR/classify new inbox files not yet in registry. */

export async function classifyInboxBatch(limit = DIL_REVIEW_UI_BATCH): Promise<ProcessBatchResult> {

  const response = await fetch(`${API_BASE}/process-batch`, {

    method: 'POST',

    headers: { 'Content-Type': 'application/json' },

    body: JSON.stringify({ limit: clampClassifyBatch(limit) }),

  });

  return parseJson<ProcessBatchResult>(response);

}



export {

  DIL_REVIEW_UI_BATCH as DEFAULT_QUEUE_LIMIT,

  DIL_REVIEW_UI_BATCH,

  DIL_CLASSIFY_BATCH_MAX,

};
