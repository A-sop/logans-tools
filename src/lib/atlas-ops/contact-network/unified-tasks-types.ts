export type UnifiedTaskSource =
  | 'linear'
  | 'microsoft_todo'
  | 'attio'
  | 'bookmark'
  | 'manual';

export type UnifiedTaskStatus = 'open' | 'done' | 'canceled';

export type UnifiedTaskTriageStatus =
  | 'imported'
  | 'needs_triage'
  | 'promoted'
  | 'archived';

export interface UnifiedTaskInboxPaths {
  todoDir: string;
  bookmarksDir: string;
  attioDir: string;
}

export interface UnifiedTaskInput {
  sourceSystem: UnifiedTaskSource;
  externalId: string;
  title: string;
  status?: UnifiedTaskStatus;
  dueDateIso?: string | null;
  url?: string | null;
  listName?: string | null;
  priority?: string | null;
  linearIssueId?: string | null;
  contactId?: number | null;
  notes?: string | null;
  triageStatus?: UnifiedTaskTriageStatus;
  bookmarkAddedAt?: string | null;
  bookmarkQuarter?: string | null;
}

export interface UnifiedTaskRecord {
  id: number;
  sourceSystem: UnifiedTaskSource;
  externalId: string;
  title: string;
  status: UnifiedTaskStatus;
  dueDate: string | null;
  url: string | null;
  listName: string | null;
  priority: string | null;
  linearIssueId: string | null;
  contactId: number | null;
  notes: string | null;
  dedupeKey: string;
  duplicateOf: number | null;
  triageStatus: UnifiedTaskTriageStatus;
  importedAt: string;
  updatedAt: string;
  bookmarkAddedAt: string | null;
  bookmarkQuarter: string | null;
  linkStatus: string | null;
  linkCheckedAt: string | null;
  linkFinalUrl: string | null;
  linkCheckNote: string | null;
  bookmarkReview: string | null;
}

export interface UnifiedTasksImportReport {
  importedAt: string;
  sourcesAttempted: UnifiedTaskSource[];
  counts: {
    bySource: Record<string, number>;
    byStatus: Record<string, number>;
    byTriageStatus: Record<string, number>;
    duplicates: number;
    open: number;
  };
  missingInputs: Array<{ source: UnifiedTaskSource; path: string }>;
  topDuplicateGroups: Array<{
    dedupeKey: string;
    count: number;
    titles: string[];
    sources: string[];
  }>;
}
