export type BookmarkLinkStatus =
  | 'live'
  | 'redirect_ok'
  | 'dead'
  | 'blocked'
  | 'timeout'
  | 'error'
  | 'unknown';

export type BookmarkReviewFilter = 'todo' | 'noted' | 'kept' | 'all';

export type BookmarkReviewDecision = 'keep' | 'delete';

export interface BookmarkQueueItem {
  id: number;
  title: string;
  url: string;
  listName: string | null;
  bookmarkAddedAt: string | null;
  bookmarkQuarter: string | null;
  notes: string | null;
  linkStatus: BookmarkLinkStatus | null;
  linkCheckedAt: string | null;
  linkFinalUrl: string | null;
  linkCheckNote: string | null;
  bookmarkReview: string | null;
  triageStatus: string;
}

export interface BookmarkQueueResponse {
  items: BookmarkQueueItem[];
  total: number;
  showing: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface BookmarkReviewStats {
  todo: number;
  noted: number;
  kept: number;
  totalOpen: number;
}

export interface BookmarkDecisionPayload {
  id: number;
  decision: BookmarkReviewDecision;
  notes?: string;
  deleteFromChrome?: boolean;
  recheckLink?: boolean;
}

export interface BookmarkDecisionResult {
  item: BookmarkQueueItem;
  chromeDeleted: boolean;
  chromeBackupPath: string | null;
  chromeError: string | null;
  linkCheck: {
    url: string;
    status: BookmarkLinkStatus;
    httpStatus: number | null;
    finalUrl: string | null;
    note: string;
    checkedAt: string;
  } | null;
}
