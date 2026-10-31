/**
 * Div1 primary: artifacts_indexed = wiki pages ADDED to DABOS docs/wiki/index.md during the
 * closed stat week (Logan: a stat counts in the week the event happened). Not the running total.
 *
 * Page = unique normalised Markdown link target in the index (as in #32 / ruling 2026-10-21):
 * `\` -> `/`, leading `./` and trailing `/` dropped, lowercase; external URLs and pure anchors
 * skipped. Added = pages present at the window end that were not present at the window start.
 * Removals are not subtracted (recorded in the basis as pages_removed).
 *
 * Window = org-week.ts stat week [Thu 14:00, next Thu 14:00) Europe/Berlin.
 *
 * Sources, in order:
 *  1. git: DABOS_REPO_ROOT is its own git work tree (a shallow clone only if cut off before the\n *     window start) AND its working-tree index equals
 *     the index at the git ref (so the history is not stale). Start/end snapshots are the index at
 *     the last first-parent commit (committer time) before the window start / end, i.e. the week
 *     the change landed on the branch.
 *  2. snapshot: no trustworthy git history (ln02 reads a Seagate mirror whose backup excludes .git).
 *     Start = the page fingerprints stored on the previous stat week's Div1 row; end = the current
 *     index file, refused when the file was modified at or after the close.
 *  Neither available -> NOT POSTED with a reason (never a silent 0).
 *
 * Privacy: callers log counts, commit SHAs and the index path only. The basis keeps page
 * fingerprints (truncated SHA-256 of the normalised target), never page names.
 *
 * W44 check (DABOS main, Thu 2026-10-22 14:00 -> Thu 2026-10-29 14:00 Berlin): 232 -> 292 = 60 added.
 */
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { existsSync, readFileSync, realpathSync, statSync } from 'fs';
import path from 'path';

import type { ClosedOrgWeek } from '@/lib/dabos/org-week';

/** Index path relative to the DABOS repo root (git paths use forward slashes). */
export const WIKI_INDEX_REL = 'docs/wiki/index.md';

const LINK_RE = /\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

export function normaliseWikiTarget(raw: string): string | null {
  let t = raw.trim().split('#')[0] ?? '';
  if (!t || /^[a-z][a-z0-9+.-]*:/i.test(t)) return null; // http:, mailto:, ...
  t = t.replace(/\\/g, '/').replace(/^(\.\/)+/, '').replace(/\/+$/, '');
  return t ? t.toLowerCase() : null;
}

/** Unique normalised page targets linked from the wiki index text. */
export function wikiPageTargets(indexText: string): Set<string> {
  const pages = new Set<string>();
  for (const line of indexText.split(/\r?\n/)) {
    for (const m of line.matchAll(LINK_RE)) {
      const t = normaliseWikiTarget(m[1] ?? '');
      if (t) pages.add(t);
    }
  }
  return pages;
}

/** Running total of unique pages (for the basis; the posted value is the weekly addition). */
export function countUniqueWikiPages(indexText: string): number {
  return wikiPageTargets(indexText).size;
}

/** Truncated SHA-256 of a normalised target: stored instead of the page name. */
export function pageFingerprint(target: string): string {
  return createHash('sha256').update(target, 'utf8').digest('hex').slice(0, 16);
}

export function wikiPageFingerprints(indexText: string): string[] {
  return [...wikiPageTargets(indexText)].map(pageFingerprint).sort();
}

/** Pages in `end` not in `start` (added) and in `start` not in `end` (removed). */
export function pagesAddedBetween(
  start: Iterable<string>,
  end: Iterable<string>
): { added: number; removed: number } {
  const s = new Set(start);
  const e = new Set(end);
  let added = 0;
  let removed = 0;
  for (const p of e) if (!s.has(p)) added += 1;
  for (const p of s) if (!e.has(p)) removed += 1;
  return { added, removed };
}

/** Runs `git <args>` and returns stdout; throws on a non-zero exit. */
export type GitRunner = (_args: string[]) => string;

export const defaultGitRunner: GitRunner = (args) =>
  execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });

/**
 * `--before` value for "strictly before `t`": git compares whole seconds (inclusive), so use the
 * last whole second before t (t - 1 ms, floored). Commit at 13:59:59 Berlin counts; 14:00:00 does not.
 */
export function gitBeforeArg(t: Date): string {
  const s = Math.floor((t.getTime() - 1) / 1000) * 1000;
  return new Date(s).toISOString().replace('.000Z', 'Z');
}

type Window = Pick<ClosedOrgWeek, 'start' | 'end'>;

export type Div1WeeklyBasis = {
  wiki_index: string;
  method: 'git' | 'snapshot';
  pages_at_start: number;
  pages_at_end: number;
  pages_added: number;
  pages_removed: number;
  /** Sorted fingerprints of the pages at the window end: next week's snapshot baseline. */
  page_fingerprints: string[];
  fingerprint_rule: string;
  git_ref?: string;
  git_start_commit?: string | null;
  git_end_commit?: string | null;
  snapshot_baseline_week?: string;
};

export type Div1WeeklyResult =
  | { ok: true; value: number; basis: Div1WeeklyBasis }
  | { ok: false; reason: string };

const FINGERPRINT_RULE = 'sha256(normalised target) first 16 hex; added = end - start';

type GitHistory =
  | { ok: true; startText: string; endText: string; startCommit: string | null; endCommit: string | null }
  | { ok: false; reason: string };

/** Start/end index text from git, or why git history cannot be trusted here. */
export function readWikiIndexFromGit(
  repoRoot: string,
  window: Window,
  opts: { ref?: string; git?: GitRunner } = {}
): GitHistory {
  const git = opts.git ?? defaultGitRunner;
  const ref = opts.ref ?? 'HEAD';
  const run = (args: string[]) => git(['-C', repoRoot, ...args]).trim();
  let top: string;
  try {
    top = run(['rev-parse', '--show-toplevel']);
  } catch {
    return { ok: false, reason: 'not a git work tree' };
  }
  // realpath: Windows short (8.3) names and symlinks must not make the same dir look different.
  const real = (p: string) => {
    try {
      return realpathSync.native(p);
    } catch {
      return path.resolve(p);
    }
  };
  if (path.relative(real(top), real(repoRoot)) !== '') {
    return { ok: false, reason: 'DABOS_REPO_ROOT is not the git top level' };
  }
  try {
    if (run(['rev-parse', '--is-shallow-repository']) === 'true') {
      // A shallow clone is fine only when every cut-off commit is older than the window start
      // (then the start snapshot is still visible); otherwise the start would read as empty.
      const shallowFile = path.resolve(repoRoot, run(['rev-parse', '--git-path', 'shallow']));
      const cuts = existsSync(shallowFile)
        ? readFileSync(shallowFile, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
        : [];
      if (cuts.length === 0) return { ok: false, reason: 'shallow git history (cut-off unknown)' };
      for (const c of cuts) {
        const ct = Number(run(['show', '-s', '--format=%ct', c])) * 1000;
        if (!(ct < window.start.getTime())) {
          return { ok: false, reason: 'shallow git history does not reach the window start' };
        }
      }
    }
    const refBlob = run(['rev-parse', `${ref}:${WIKI_INDEX_REL}`]);
    const worktreeBlob = run(['hash-object', '--', WIKI_INDEX_REL]);
    if (refBlob !== worktreeBlob) {
      return { ok: false, reason: `working-tree index differs from ${ref} (git history stale or uncommitted)` };
    }
    const lastBefore = (t: Date) =>
      run(['rev-list', '-1', '--first-parent', `--before=${gitBeforeArg(t)}`, ref, '--', WIKI_INDEX_REL]) ||
      null;
    const startCommit = lastBefore(window.start);
    const endCommit = lastBefore(window.end);
    const show = (c: string | null) => (c ? git(['-C', repoRoot, 'show', `${c}:${WIKI_INDEX_REL}`]) : '');
    return { ok: true, startText: show(startCommit), endText: show(endCommit), startCommit, endCommit };
  } catch (err) {
    const code = err instanceof Error && 'status' in err ? ` (git exit ${String(err.status)})` : '';
    return { ok: false, reason: `git history unreadable${code}` };
  }
}

export async function computeArtifactsIndexedWeekly(opts: {
  window: Window;
  repoRoot: string;
  gitRef?: string;
  git?: GitRunner;
  /** Previous stat week's Div1 row fingerprints (null = no usable row). Only used without git. */
  loadPreviousFingerprints?: () => Promise<{ week: string; fingerprints: string[] } | null>;
}): Promise<Div1WeeklyResult> {
  const { window, repoRoot } = opts;
  const indexAbs = path.join(repoRoot, ...WIKI_INDEX_REL.split('/'));
  if (!existsSync(indexAbs)) {
    return { ok: false, reason: `wiki index missing at ${indexAbs}` };
  }

  const ref = opts.gitRef ?? 'HEAD';
  const fromGit = readWikiIndexFromGit(repoRoot, window, { ref, git: opts.git });
  if (fromGit.ok) {
    const start = wikiPageFingerprints(fromGit.startText);
    const end = wikiPageFingerprints(fromGit.endText);
    const { added, removed } = pagesAddedBetween(start, end);
    return {
      ok: true,
      value: added,
      basis: {
        wiki_index: WIKI_INDEX_REL,
        method: 'git',
        pages_at_start: start.length,
        pages_at_end: end.length,
        pages_added: added,
        pages_removed: removed,
        page_fingerprints: end,
        fingerprint_rule: FINGERPRINT_RULE,
        git_ref: ref,
        git_start_commit: fromGit.startCommit,
        git_end_commit: fromGit.endCommit,
      },
    };
  }

  let previous: { week: string; fingerprints: string[] } | null = null;
  try {
    previous = (await opts.loadPreviousFingerprints?.()) ?? null;
  } catch (err) {
    return {
      ok: false,
      reason: `git unavailable (${fromGit.reason}); previous-week baseline lookup failed: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }
  if (!previous) {
    return {
      ok: false,
      reason: `git unavailable (${fromGit.reason}) and no previous-week Div1 baseline row; cannot tell which pages were added this week`,
    };
  }
  const mtime = statSync(indexAbs).mtime;
  if (mtime.getTime() >= window.end.getTime()) {
    return {
      ok: false,
      reason: `git unavailable (${fromGit.reason}); index file modified ${mtime.toISOString()}, at or after the close ${window.end.toISOString()}, so its changes cannot be attributed to this week`,
    };
  }
  const end = wikiPageFingerprints(readFileSync(indexAbs, 'utf8'));
  const { added, removed } = pagesAddedBetween(previous.fingerprints, end);
  return {
    ok: true,
    value: added,
    basis: {
      wiki_index: WIKI_INDEX_REL,
      method: 'snapshot',
      pages_at_start: new Set(previous.fingerprints).size,
      pages_at_end: end.length,
      pages_added: added,
      pages_removed: removed,
      page_fingerprints: end,
      fingerprint_rule: FINGERPRINT_RULE,
      snapshot_baseline_week: previous.week,
    },
  };
}

export const ARTIFACTS_INDEXED_BASIS = {
  ssot: 'DABOS/docs/wiki/index.md',
  rule: 'unique wiki pages added in the closed stat week (Thu 14:00 -> Thu 14:00 Europe/Berlin)',
};