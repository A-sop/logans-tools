/**
 * Learned from Logan's bookmark triage session (2026-07-12/13).
 * Heuristic hints only — never auto-delete without explicit decision.
 */
export type BookmarkPruneHintLevel = 'high' | 'medium';

export type BookmarkPruneHint = {
  level: BookmarkPruneHintLevel;
  reason: string;
};

const STUMBLEUPON_PREFIX = 'StumbleUpon - Aesop';

export function bookmarkPruneHint(listName: string | null | undefined): BookmarkPruneHint | null {
  if (!listName) return null;
  if (listName.includes(STUMBLEUPON_PREFIX)) {
    return {
      level: 'high',
      reason:
        'StumbleUpon-era link — ~90% of your decisions here were Delete (link health did not matter). Safe default: Delete unless you riff a keep reason.',
    };
  }
  if (listName.includes('/ LDW_') || listName.endsWith('LDW_')) {
    return {
      level: 'medium',
      reason: 'LDW scratch folder — mostly pruned in your session so far.',
    };
  }
  if (listName.includes('/ Wise') || listName.includes('/ Wealthy /')) {
    return {
      level: 'medium',
      reason: 'Old curated lists (Wise/Wealthy) — low keep rate in your triage so far.',
    };
  }
  if (listName.includes('AF_') && listName.includes('bKV_leads')) {
    return {
      level: 'medium',
      reason: 'Legacy AF leads bookmark — likely stale unless you need the reference.',
    };
  }
  return null;
}

/** Domains where automated fetch often fails but Chrome may still work. */
export const FETCH_UNRELIABLE_HOST_PATTERNS = [
  /livejournal\.com/i,
  /blogspot\./i,
  /wordpress\.com/i,
  /newgrounds\.com/i,
  /behance\.net/i,
  /linkedin\.com/i,
];

export function isFetchUnreliableHost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return FETCH_UNRELIABLE_HOST_PATTERNS.some((re) => re.test(host));
  } catch {
    return false;
  }
}
