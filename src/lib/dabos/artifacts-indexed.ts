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
 * Start point (acceptance line 7, amendment 1): the previous stat week's active Div1 row
 * `basis.page_fingerprints` whenever it exists, so a page counted once is never counted again.
 * End point, in order:
 *  1. git: the index on `origin/main` (a remote-tracking ref, never HEAD) as it was at the close =
 *     the newest commit touching the index with committer time strictly before the close, over
 *     full history (a page made in week N that reached main by a merge into a stale copy still
 *     counts in week N). It must descend from the previous row's git_end_commit when recorded.
 *     Only in the first week (no previous row) are start AND end read from git, first-parent.
 *     Git is trusted only when origin/main was fetched at or after the close (see originFetchedAt).
 *     A git work tree that fails any check is NOT POSTED: it never falls back to its working copy.
 *  2. snapshot: DABOS_REPO_ROOT is not a git work tree, or source 'snapshot' is set explicitly
 *     (DABOS_WIKI_SOURCE=snapshot, for ln02's Seagate mirror, whose .git is a stale leftover): the
 *     current index file, refused when it was modified at or after the close.
 *  Neither available -> NOT POSTED with a reason (never a silent 0).
 *
 * Privacy: callers log counts, commit SHAs and the index path only. The basis keeps page
 * fingerprints (see pageFingerprint), never page names.
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

/** Default git ref: the fetched GitHub main, never the local checkout's HEAD or branch. */
export const DEFAULT_WIKI_GIT_REF = 'origin/main';

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

/**
 * Page fingerprint stored instead of the page name: lowercase hex SHA-256 (no salt) of the UTF-8
 * normalised target (normaliseWikiTarget), first 16 hex chars.
 */
export function pageFingerprint(normalisedTarget: string): string {
  return createHash('sha256').update(normalisedTarget, 'utf8').digest('hex').slice(0, 16);
}

/** `basis.page_fingerprints`: unique fingerprints of every page in the index, sorted ascending. */
export function wikiPageFingerprints(indexText: string): string[] {
  return [...new Set([...wikiPageTargets(indexText)].map(pageFingerprint))].sort();
}

export const FINGERPRINT_RE = /^[0-9a-f]{16}$/;

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

/** The previous stat week's active Div1 row, as read by loadPreviousDiv1Fingerprints. */
export type PreviousDiv1Row = { week: string; fingerprints: string[]; gitEndCommit?: string | null };

export type Div1WeeklyBasis = {
  wiki_index: string;
  method: 'git' | 'snapshot';
  /** Where the start point came from. */
  start_source: 'previous_row' | 'git_first_parent';
  pages_at_start: number;
  pages_at_end: number;
  pages_added: number;
  pages_removed: number;
  /** Sorted unique fingerprints of the pages at the window end: next week's start point. */
  page_fingerprints: string[];
  fingerprint_rule: string;
  snapshot_baseline_week?: string;
  git_ref?: string;
  git_start_commit?: string | null;
  git_end_commit?: string | null;
  git_fetched_at?: string;
  git_fetch_signal?: 'reflog' | 'FETCH_HEAD';
};

export type Div1WeeklyResult =
  | { ok: true; value: number; basis: Div1WeeklyBasis }
  | { ok: false; reason: string };

export const FINGERPRINT_RULE =
  'sha256(utf8 normalised target), no salt, first 16 lowercase hex; unique, sorted; added = end - start';

const REMOTE_REF_RE = /^([A-Za-z0-9._-]+)\/([A-Za-z0-9._/-]+)$/;

/**
 * Remote URL in a comparable form that keeps its CLASS:
 *  - `url:<host>/<path>` for a host URL (`scheme://` other than `file://`, or scp-like `host:path`):
 *    scheme and user-info dropped (so a token never takes part), `host:path` -> `host/path`,
 *    trailing `/` and `.git` dropped, host compared case-insensitively;
 *  - `path:<path>` for a local path (no scheme and no scp colon, `file://`, or a drive path),
 *    `\` -> `/`, trailing `/` dropped (NOT `.git`: `/x/repo.git` and `/x/repo` are different
 *    repositories), drive paths compared case-insensitively.
 * A local path never equals a host URL, so a relative directory named `github.com/Org/Repo` is not
 * `https://github.com/Org/Repo`. Never log the input or the result.
 */
export function normaliseRemoteUrl(raw: string): string {
  let u = raw.trim().replace(/\\/g, '/');
  const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(u)?.[1]?.toLowerCase();
  let local: boolean;
  if (scheme) {
    u = u.slice(scheme.length + 3);
    local = scheme === 'file';
    if (local && /^\/[a-z]:\//i.test(u)) u = u.slice(1); // file:///C:/x -> C:/x
  } else {
    // git's rule: scp-like only when a ':' comes before the first '/' (and it is not a drive letter)
    local = /^[a-z]:\//i.test(u) || !/^[^/]+:/.test(u);
  }
  if (local) {
    u = u.replace(/\/+$/, '');
    return 'path:' + (/^[a-z]:\//i.test(u) ? u.toLowerCase() : u);
  }
  u = u.replace(/^[^@/]*@/, ''); // user-info
  if (!scheme) u = u.replace(/^([^/:]+):/, '$1/'); // scp-like host:path
  u = u.replace(/\/+$/, '').replace(/\.git$/i, '').replace(/\/+$/, '');
  const slash = u.indexOf('/');
  return 'url:' + (slash < 0 ? u.toLowerCase() : u.slice(0, slash).toLowerCase() + u.slice(slash));
}

/** True when the normalised remote URL is a local path (FETCH_HEAD cannot be tied to it safely). */
export function isLocalRemote(normalised: string): boolean {
  return normalised.startsWith('path:');
}

/** Reflog subjects written by a real fetch of the remote-tracking ref (`git fetch`, `git pull`). */
export const FETCH_REFLOG_SUBJECT_RE = /^(fetch|pull)\b/;

/**
 * When `<remote>/<branch>` was last fetched, from two signals (the later wins):
 *  - reflog of refs/remotes/<remote>/<branch>: the NEWEST entry whose subject starts with `fetch` or
 *    `pull`, and only when that entry's new value is the current ref commit (an `update-ref`, a
 *    `remote rename` or a push after it says nothing about what origin holds, and a later move by
 *    any of them makes the fetch entry stale);
 *  - this worktree's FETCH_HEAD mtime: rewritten by every fetch/pull even when nothing moved; only
 *    counted when <remote> is a host URL and FETCH_HEAD has a `branch '<branch>' of <url>` line
 *    naming the current ref commit whose <url> is <remote>'s own URL (same class, normalised). For a
 *    local-path <remote> FETCH_HEAD is never trusted (git drops `.git` from local paths there).
 * Reflog alone would turn every quiet week (fetch, nothing moved) into NOT POSTED; FETCH_HEAD
 * alone is ambiguous without the URL. Null when neither signal exists (never fetched).
 */
export function originFetchedAt(
  repoRoot: string,
  ref: string,
  opts: { git?: GitRunner } = {}
): { at: Date; signal: 'reflog' | 'FETCH_HEAD' } | null {
  const git = opts.git ?? defaultGitRunner;
  const m = REMOTE_REF_RE.exec(ref);
  if (!m) return null;
  const remote = m[1]!;
  const branch = m[2]!;
  const run = (args: string[]) => git(['-C', repoRoot, ...args]).trim();
  let tip = '';
  try {
    tip = run(['rev-parse', '--verify', '--quiet', `refs/remotes/${ref}^{commit}`]);
  } catch {
    return null;
  }
  if (!/^[0-9a-f]{40}$/.test(tip)) return null;
  let best: { at: Date; signal: 'reflog' | 'FETCH_HEAD' } | null = null;
  try {
    const lines = run(['reflog', 'show', '--date=unix', '--format=%H%x09%gd%x09%gs', `refs/remotes/${ref}`]).split(/\r?\n/);
    for (const line of lines) {
      const [sha = '', gd = '', subject = ''] = line.split('\t');
      if (!FETCH_REFLOG_SUBJECT_RE.test(subject)) continue;
      const secs = /@\{(\d+)\}/.exec(gd)?.[1];
      if (sha === tip && secs) best = { at: new Date(Number(secs) * 1000), signal: 'reflog' };
      break; // only the newest fetch/pull entry
    }
  } catch {
    // no reflog
  }
  try {
    const remoteUrl = normaliseRemoteUrl(run(['remote', 'get-url', remote]));
    const fetchHead = path.resolve(repoRoot, run(['rev-parse', '--git-path', 'FETCH_HEAD']));
    if (!isLocalRemote(remoteUrl) && existsSync(fetchHead)) {
      const prefix = `branch '${branch}' of `;
      const names = readFileSync(fetchHead, 'utf8')
        .split(/\r?\n/)
        .some((line) => {
          const [sha, , desc = ''] = line.split('\t');
          return (
            sha === tip &&
            desc.startsWith(prefix) &&
            normaliseRemoteUrl(desc.slice(prefix.length)) === remoteUrl
          );
        });
      const mtime = statSync(fetchHead).mtime;
      if (names && (!best || mtime.getTime() > best.at.getTime())) best = { at: mtime, signal: 'FETCH_HEAD' };
    }
  } catch {
    // no FETCH_HEAD / no remote URL
  }
  return best;
}
type GitHistory =
  | {
      ok: true;
      endText: string;
      endCommit: string | null;
      startText?: string;
      startCommit?: string | null;
      fetched: { at: Date; signal: 'reflog' | 'FETCH_HEAD' };
    }
  | { ok: false; reason: string; notGit?: boolean };

/**
 * Index text from git at the close (and, in the first week, at the opening), or why git cannot be
 * trusted here.
 */
export function readWikiIndexFromGit(
  repoRoot: string,
  window: Window,
  opts: { ref?: string; git?: GitRunner; firstWeek?: boolean; previousEndCommit?: string | null } = {}
): GitHistory {
  const git = opts.git ?? defaultGitRunner;
  const ref = opts.ref ?? DEFAULT_WIKI_GIT_REF;
  const firstWeek = opts.firstWeek ?? false;
  const run = (args: string[]) => git(['-C', repoRoot, ...args]).trim();
  let top: string;
  try {
    top = run(['rev-parse', '--show-toplevel']);
  } catch {
    return { ok: false, reason: 'not a git work tree', notGit: true };
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
    return { ok: false, reason: 'DABOS_REPO_ROOT is not the git top level', notGit: true };
  }
  const fullRef = `refs/remotes/${ref}`;
  try {
    if (!REMOTE_REF_RE.test(ref)) throw new Error('bad ref');
    run(['rev-parse', '--verify', '--quiet', `${fullRef}^{commit}`]);
  } catch {
    return { ok: false, reason: `git ref ${ref} is not a remote-tracking ref (HEAD and local branches are never counted)` };
  }
  const fetched = originFetchedAt(repoRoot, ref, { git });
  if (!fetched || fetched.at.getTime() < window.end.getTime()) {
    return {
      ok: false,
      reason: `${ref} not fetched since the close ${window.end.toISOString()} (last fetch ${
        fetched ? fetched.at.toISOString() : 'unknown'
      }); git fetch after Thu 14:00 Berlin`,
    };
  }
  try {
    // Snapshots read: the close, plus the opening in the first week. Every shallow cut-off must be
    // older than the earliest of them, or that snapshot could read as a truncated history.
    const earliest = firstWeek ? window.start : window.end;
    if (run(['rev-parse', '--is-shallow-repository']) === 'true') {
      const shallowFile = path.resolve(repoRoot, run(['rev-parse', '--git-path', 'shallow']));
      const cuts = existsSync(shallowFile)
        ? readFileSync(shallowFile, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
        : [];
      if (cuts.length === 0) return { ok: false, reason: 'shallow git history (cut-off unknown)' };
      for (const c of cuts) {
        const ct = Number(run(['show', '-s', '--format=%ct', c])) * 1000;
        if (!(ct < earliest.getTime())) {
          return { ok: false, reason: 'shallow git history does not reach the snapshot time' };
        }
      }
    }
    const lastBefore = (t: Date, history: '--first-parent' | '--full-history') =>
      run(['rev-list', '-1', history, `--before=${gitBeforeArg(t)}`, fullRef, '--', WIKI_INDEX_REL]) || null;
    const show = (c: string | null) => (c ? git(['-C', repoRoot, 'show', `${c}:${WIKI_INDEX_REL}`]) : '');

    if (firstWeek) {
      const startCommit = lastBefore(window.start, '--first-parent');
      const endCommit = lastBefore(window.end, '--first-parent');
      return { ok: true, startText: show(startCommit), startCommit, endText: show(endCommit), endCommit, fetched };
    }
    const endCommit = lastBefore(window.end, '--full-history');
    const prev = opts.previousEndCommit;
    if (prev) {
      // The close snapshot must continue last week's line of history; a jump to another line (e.g.
      // a stale copy's commit) could drop pages that would then be counted again later.
      let descends = false;
      try {
        run(['merge-base', '--is-ancestor', prev, endCommit ?? '']);
        descends = true;
      } catch {
        descends = false;
      }
      if (!descends) {
        return {
          ok: false,
          reason: `close snapshot ${endCommit ?? 'none'} does not descend from last week's git_end_commit ${prev}`,
        };
      }
    }
    return { ok: true, endText: show(endCommit), endCommit, fetched };
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
  /** Previous stat week's active Div1 row (null = none): the start point in both methods. */
  loadPreviousFingerprints?: () => Promise<PreviousDiv1Row | null>;
  /** 'auto' (default): git when DABOS_REPO_ROOT is a git work tree, else snapshot. */
  source?: 'auto' | 'snapshot';
}): Promise<Div1WeeklyResult> {
  const { window, repoRoot } = opts;
  const indexAbs = path.join(repoRoot, ...WIKI_INDEX_REL.split('/'));
  if (!existsSync(indexAbs)) {
    return { ok: false, reason: `wiki index missing at ${indexAbs}` };
  }

  let previous: PreviousDiv1Row | null = null;
  try {
    previous = (await opts.loadPreviousFingerprints?.()) ?? null;
  } catch (err) {
    return {
      ok: false,
      reason: `previous-week Div1 row lookup failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  const startFps = previous ? [...new Set(previous.fingerprints)].sort() : null;

  const ref = opts.gitRef ?? DEFAULT_WIKI_GIT_REF;
  const fromGit: GitHistory =
    opts.source === 'snapshot'
      ? { ok: false, reason: 'source snapshot requested', notGit: true }
      : readWikiIndexFromGit(repoRoot, window, {
          ref,
          git: opts.git,
          firstWeek: !previous,
          previousEndCommit: previous?.gitEndCommit ?? null,
        });
  if (!fromGit.ok && !fromGit.notGit) {
    // A git checkout that is stale, unfetched, on the wrong ref or off last week's line: its
    // working copy is not trusted either (that would be a silent stale count).
    return { ok: false, reason: `git: ${fromGit.reason}` };
  }
  if (fromGit.ok) {
    const start = startFps ?? wikiPageFingerprints(fromGit.startText ?? '');
    const end = wikiPageFingerprints(fromGit.endText);
    const { added, removed } = pagesAddedBetween(start, end);
    return {
      ok: true,
      value: added,
      basis: {
        wiki_index: WIKI_INDEX_REL,
        method: 'git',
        start_source: previous ? 'previous_row' : 'git_first_parent',
        pages_at_start: start.length,
        pages_at_end: end.length,
        pages_added: added,
        pages_removed: removed,
        page_fingerprints: end,
        fingerprint_rule: FINGERPRINT_RULE,
        ...(previous ? { snapshot_baseline_week: previous.week } : { git_start_commit: fromGit.startCommit ?? null }),
        git_ref: ref,
        git_end_commit: fromGit.endCommit,
        git_fetched_at: fromGit.fetched.at.toISOString(),
        git_fetch_signal: fromGit.fetched.signal,
      },
    };
  }

  if (!previous || !startFps) {
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
  const { added, removed } = pagesAddedBetween(startFps, end);
  return {
    ok: true,
    value: added,
    basis: {
      wiki_index: WIKI_INDEX_REL,
      method: 'snapshot',
      start_source: 'previous_row',
      pages_at_start: startFps.length,
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