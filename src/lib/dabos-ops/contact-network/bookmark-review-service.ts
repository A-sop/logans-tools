import { checkBookmarkUrl } from '@/lib/dabos-ops/contact-network/bookmark-link-check';
import type {
  BookmarkDecisionPayload,
  BookmarkDecisionResult,
  BookmarkLinkStatus,
  BookmarkQueueItem,
  BookmarkQueueResponse,
  BookmarkReviewFilter,
  BookmarkReviewStats,
} from '@/lib/dabos-ops/contact-network/bookmark-review-types';
import { getLocalCrmPaths } from '@/lib/dabos-ops/contact-network/local-crm-config';
import { deleteChromeBookmarkByUrl } from '@/lib/dabos-ops/contact-network/chrome-bookmarks-modify';
import { UnifiedTasksIndex } from '@/lib/dabos-ops/contact-network/unified-tasks-index';
import type { UnifiedTaskRecord } from '@/lib/dabos-ops/contact-network/unified-tasks-types';
import { clampReviewBatch } from '@/lib/dabos-ops/document-intake/review-config';

const LINK_RECHECK_MS = 7 * 24 * 60 * 60 * 1000;

function openIndex(): UnifiedTasksIndex {
  return new UnifiedTasksIndex(getLocalCrmPaths().dbPath);
}

function toQueueItem(row: UnifiedTaskRecord): BookmarkQueueItem {
  return {
    id: row.id,
    title: row.title,
    url: row.url ?? '',
    listName: row.listName,
    bookmarkAddedAt: row.bookmarkAddedAt,
    bookmarkQuarter: row.bookmarkQuarter,
    notes: row.notes,
    linkStatus: (row.linkStatus as BookmarkLinkStatus | null) ?? null,
    linkCheckedAt: row.linkCheckedAt,
    linkFinalUrl: row.linkFinalUrl,
    linkCheckNote: row.linkCheckNote,
    bookmarkReview: row.bookmarkReview,
    triageStatus: row.triageStatus,
  };
}

function needsLinkCheck(row: UnifiedTaskRecord): boolean {
  if (!row.url) return false;
  if (!row.linkCheckedAt) return true;
  const age = Date.now() - Date.parse(row.linkCheckedAt);
  return !Number.isFinite(age) || age > LINK_RECHECK_MS;
}

export async function ensureBookmarkLinkCheck(row: UnifiedTaskRecord): Promise<UnifiedTaskRecord> {
  if (!row.url || !needsLinkCheck(row)) return row;
  const index = openIndex();
  try {
    const result = await checkBookmarkUrl(row.url);
    const updated =
      index.updateBookmarkLinkCheck(row.id, {
        linkStatus: result.status,
        linkCheckedAt: result.checkedAt,
        linkFinalUrl: result.finalUrl,
        linkCheckNote: result.note,
      }) ?? row;
    return updated;
  } finally {
    index.close();
  }
}

export function listBookmarkReviewPage(
  filter: BookmarkReviewFilter,
  limit: number | null,
  offset: number
): BookmarkQueueResponse {
  const index = openIndex();
  try {
    const batch = limit == null ? 5000 : clampReviewBatch(limit);
    const { items, total } = index.listBookmarkReviewQueue(filter, batch, offset);
    return {
      items: items.map(toQueueItem),
      total,
      showing: items.length,
      limit: batch,
      offset,
      hasMore: offset + items.length < total,
    };
  } finally {
    index.close();
  }
}

export function getBookmarkReviewStats(): BookmarkReviewStats {
  const index = openIndex();
  try {
    return index.getBookmarkReviewStats();
  } finally {
    index.close();
  }
}

export async function saveBookmarkNotes(id: number, notes: string): Promise<BookmarkQueueItem | null> {
  const index = openIndex();
  try {
    const updated = index.updateBookmarkNotes(id, notes);
    return updated ? toQueueItem(updated) : null;
  } finally {
    index.close();
  }
}

export async function applyBookmarkDecision(payload: BookmarkDecisionPayload): Promise<BookmarkDecisionResult> {
  const index = openIndex();
  try {
    let row = index.getBookmarkById(payload.id);
    if (!row) throw new Error('Bookmark not found');

    let linkCheck = null;
    if (payload.recheckLink !== false && row.url) {
      row = await ensureBookmarkLinkCheck(row);
      linkCheck = {
        url: row.url!,
        status: (row.linkStatus as BookmarkLinkStatus) ?? 'unknown',
        httpStatus: null,
        finalUrl: row.linkFinalUrl,
        note: row.linkCheckNote ?? '',
        checkedAt: row.linkCheckedAt ?? new Date().toISOString(),
      };
    }

    let chromeDeleted = false;
    let chromeBackupPath: string | null = null;
    let chromeError: string | null = null;

    if (payload.decision === 'delete' && payload.deleteFromChrome !== false && row.url) {
      try {
        const chrome = deleteChromeBookmarkByUrl(row.url);
        chromeDeleted = chrome.removed.length > 0;
        chromeBackupPath = chrome.backupPath;
        if (!chromeDeleted) {
          chromeError = 'URL not found in Chrome Bookmarks file (index will still archive).';
        }
      } catch (err) {
        chromeError = err instanceof Error ? err.message : String(err);
        throw new Error(`${chromeError} Close Chrome completely and retry Delete.`);
      }
    }

    const updated = index.applyBookmarkReviewDecision(payload.id, payload.decision, payload.notes ?? row.notes);
    if (!updated) throw new Error('Failed to save bookmark decision');

    return {
      item: toQueueItem(updated),
      chromeDeleted,
      chromeBackupPath,
      chromeError,
      linkCheck,
    };
  } finally {
    index.close();
  }
}

export async function checkBookmarkById(id: number): Promise<BookmarkQueueItem | null> {
  const index = openIndex();
  try {
    const row = index.getBookmarkById(id);
    if (!row?.url) return row ? toQueueItem(row) : null;
    const updated = await ensureBookmarkLinkCheck(row);
    return toQueueItem(updated);
  } finally {
    index.close();
  }
}
