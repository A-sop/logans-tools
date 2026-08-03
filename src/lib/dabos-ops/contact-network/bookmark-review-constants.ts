export const BOOKMARK_IMPORT_NOTE =
  'Imported Chrome bookmark — triage to task, reference, or delete';

/** Bookmark review queue page size (independent of DIL inbox batch). */
export const BOOKMARK_REVIEW_UI_BATCH = 50;

/** Alias for UI imports. */
export const BOOKMARK_REVIEW_BATCH = BOOKMARK_REVIEW_UI_BATCH;

export function isCustomBookmarkNote(notes: string | null | undefined): boolean {
  if (!notes) return false;
  const trimmed = notes.trim();
  return trimmed.length > 0 && trimmed !== BOOKMARK_IMPORT_NOTE;
}

export function bookmarkReviewFromNotes(notes: string | null | undefined): 'noted' | 'pending' {
  return isCustomBookmarkNote(notes) ? 'noted' : 'pending';
}
