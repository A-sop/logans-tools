/** Review UI working set — how many files appear in the sidebar at once (instant DB read). */
export const DIL_REVIEW_UI_BATCH = 35;

/** Max files per OCR/classify run (slow — inbox or inventory intake only). */
export const DIL_CLASSIFY_BATCH_MAX = 350;

export function clampReviewBatch(raw: number | undefined | null): number {
  if (!raw || !Number.isFinite(raw) || raw <= 0) return DIL_REVIEW_UI_BATCH;
  return Math.min(Math.floor(raw), DIL_CLASSIFY_BATCH_MAX);
}

export function clampClassifyBatch(raw: number | undefined | null): number {
  if (!raw || !Number.isFinite(raw) || raw <= 0) return DIL_REVIEW_UI_BATCH;
  return Math.min(Math.floor(raw), DIL_CLASSIFY_BATCH_MAX);
}

/** @deprecated use DIL_REVIEW_UI_BATCH / DIL_CLASSIFY_BATCH_MAX */
export const DIL_REVIEW_BATCH_LIMIT = DIL_CLASSIFY_BATCH_MAX;

/** @deprecated use clampReviewBatch */
export function clampBatchLimit(raw: number | undefined | null): number {
  return clampClassifyBatch(raw);
}
