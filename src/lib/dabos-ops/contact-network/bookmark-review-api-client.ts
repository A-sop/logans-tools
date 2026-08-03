import type {
  BookmarkDecisionPayload,
  BookmarkDecisionResult,
  BookmarkQueueItem,
  BookmarkQueueResponse,
  BookmarkReviewFilter,
  BookmarkReviewStats,
} from '@/lib/dabos-ops/contact-network/bookmark-review-types';
import { BOOKMARK_REVIEW_UI_BATCH } from '@/lib/dabos-ops/contact-network/bookmark-review-constants';
import { clampReviewBatch } from '@/lib/dabos-ops/document-intake/review-config';

const API_BASE = '/api/dabos/dil/review/bookmarks';

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function fetchBookmarkStats(): Promise<BookmarkReviewStats> {
  const response = await fetch(`${API_BASE}/stats`, { cache: 'no-store' });
  return parseJson<BookmarkReviewStats>(response);
}

export async function fetchBookmarkQueue(
  filter: BookmarkReviewFilter = 'todo',
  limit: number | 'all' = BOOKMARK_REVIEW_UI_BATCH,
  offset = 0
): Promise<BookmarkQueueResponse> {
  const limitParam = limit === 'all' ? 'all' : String(clampReviewBatch(limit));
  const response = await fetch(
    `${API_BASE}/queue?filter=${encodeURIComponent(filter)}&limit=${limitParam}&offset=${Math.max(0, offset)}`,
    { cache: 'no-store' }
  );
  return parseJson<BookmarkQueueResponse>(response);
}

export async function saveBookmarkDecision(payload: BookmarkDecisionPayload): Promise<BookmarkDecisionResult> {
  const response = await fetch(`${API_BASE}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson<BookmarkDecisionResult>(response);
}

export async function saveBookmarkNotesOnly(id: number, notes: string): Promise<BookmarkQueueItem> {
  const response = await fetch(`${API_BASE}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, notes, notesOnly: true }),
  });
  const body = await parseJson<{ item: BookmarkQueueItem }>(response);
  return body.item;
}

export async function recheckBookmarkLink(id: number): Promise<BookmarkQueueItem> {
  const response = await fetch(`${API_BASE}/decision?id=${id}`, { cache: 'no-store' });
  const body = await parseJson<{ item: BookmarkQueueItem }>(response);
  return body.item;
}
