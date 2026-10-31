# Acceptance: Div1 artifacts_indexed = wiki pages added in the stat week

Recorded before any code (criterion 2). Requested by Div1; built by Div4. Supersedes logans-tools #32
(Dept13 FAIL: its test fixture history leaked a real ad account ID and prospect names).

Rule: a stat counts in the week the event happened (Logan). Stat week = org-week.ts:
[Thu 14:00, next Thu 14:00) Europe/Berlin, start inclusive, end exclusive; label = ISO week of the
closing Thursday (W44 = Thu 2026-10-22 14:00 -> Thu 2026-10-29 14:00 Berlin).

Acceptance lines:

1. `postDivisionWeeklyStats` emits a Div1 row: `division_id = 'Div1'`, `department_id = NULL`,
   `metric_key = 'artifacts_indexed'`, workspace `div-live-YYYY-Www`, `recorded_at` = close minus 1 ms
   (same as the other division rows).
2. Value = number of pages ADDED to DABOS `docs/wiki/index.md` within the stat week window: unique page
   link targets present at the window end that were not present at the window start (page = unique
   normalised link target, as in #32: `\` -> `/`, leading `./` and trailing `/` dropped, lowercase,
   external URLs and pure anchors skipped). Not the running total. Removals are not subtracted
   (they are recorded in the row basis).
3. W44 reproduces from the real DABOS git history: 232 pages at the window start, 292 at the window end,
   60 added. Only counts are reported (PR, notes, tests); no page names or index content.
4. Test fixtures are fully synthetic: no real account IDs, names, emails, or other client/prospect data,
   and nothing copied from DABOS. The whole diff is grepped for real-looking IDs/names before push.
5. Missing data fails visibly, never a silent 0: if the index is missing, or no trustworthy start-of-week
   baseline exists, or the snapshot cannot be attributed to the week, no Div1 row is written and a
   `Div1 artifacts_indexed NOT POSTED - <reason>` note is returned (stat crawl keeps showing missing_emit).
6. No PII in logs: notes and logs carry counts, commit SHAs and the index path only; page names are never
   logged. The row basis stores page fingerprints (truncated SHA-256), not page names.
7. Sources, in order (AMENDED 2026-10-31, Dept13 FAIL v1 F1/F2; the original 7(a) first-parent rule is
   replaced):
   - Start point: the previous stat week's active Div1 row (`superseded_at is null`, any
     `recorded_by`, `department_id` NULL) `basis.page_fingerprints`, whenever that row exists, in
     BOTH methods.
   - (a) git: the end-of-week snapshot is the index on `origin/main` (a remote-tracking ref; never
     `HEAD` or a local branch) as it was at the close: the newest commit touching the index with
     committer time strictly before the close, over full history (not first-parent), so a page counts
     in the week its commit was made even when it reached main through a merge into a stale copy
     (133ea3be shape). It must descend from the previous row's `git_end_commit` when that is recorded.
     Only in the first week (no previous row) are both snapshots read from git, first-parent.
     Git is used only when `origin/main` was fetched at or after the close: (i) the NEWEST reflog entry
     of `refs/remotes/origin/main` whose subject starts with `fetch` or `pull` is at or after the close
     AND its new value is the current `origin/main` commit (entries from `update-ref`, `remote rename`,
     push etc. are skipped, never counted as a fetch); or (ii) a `FETCH_HEAD` (this worktree's) modified
     at or after the close with a line `<sha>` / `branch 'main' of <url>` where `<sha>` is the current
     `origin/main` commit AND `<url>` is origin's own URL (`git remote get-url origin`). URLs are
     normalised keeping their class: a host URL (`scheme://` other than `file://`, or scp `host:path`)
     drops scheme and user-info, `host:path` -> `host/path`, trailing `/` and `.git` dropped, host
     case-insensitive; a local path (no scheme, `file://`, or a drive path) is a different class and
     never equals a host URL. When origin itself is a local path, FETCH_HEAD is not trusted at all
     (git writes local paths without `.git`, so `/x/repo.git` and `/x/repo` would be confused): only
     (i) counts. A line fetched from any other remote, or for another branch of origin, never counts
     (AMENDED 2026-10-31, Dept13 FAIL v2 and v3).
     Otherwise git is not trusted (NOT POSTED unless (b) applies).
   - (b) no usable git (e.g. ln02, whose Seagate mirror excludes `.git`): the previous row's
     fingerprints as the start and the current index file as the end, refused if the file was modified
     at or after the close.
   A page that was counted once is never counted again because of a first-parent or stale-copy view.
8. Tests (AMENDED: also a test reproducing the 133ea3be merge shape (truth W38 = 3, W40 = 0), a stale /
   never-fetched clone and a non-remote ref posting NOT POSTED, the `--only` filter, and the
   `superseded_at is null` lookup; each fix has its own mutation check): the new tests fail on main (mutation check); targeted tests, full vitest, tsc and eslint on
   touched files pass.
9. No merge without Dept13 PASS and Logan's own yes. After merge ln02 must pull main before
   Thu 5 Nov 14:30 Berlin. #32 is not closed here; its branch history still holds the leaked fixture.

Amendment 1 (2026-10-31, after Dept13 FAIL v1 at de28d7a): lines 7 and 8 amended above; line 5 is
unchanged and now also covers a never-fetched or non-`origin/main` git checkout. Fingerprint format
read from the previous row (so the backfill PR #49 can write it byte-for-byte): `basis.page_fingerprints`
= JSON array of strings, each the lowercase hex SHA-256 of the UTF-8 normalised target (rule of line 2,
no salt), first 16 hex chars, unique, sorted ascending; exported as `pageFingerprint` /
`wikiPageFingerprints` from `src/lib/dabos/artifacts-indexed.ts`.

Amendment 2 (2026-10-31, after Dept13 FAIL v2 at a20da8a): line 7(a) FETCH_HEAD signal amended above
(must come from origin's URL and name branch main); reflog of refs/remotes/origin/main unchanged. Tests: a
second remote holding the same commit fetched after the close, and another branch of origin at the same
commit, are both NOT POSTED; the URL and branch checks each have a mutation check. The remote URL is never
logged or stored (user-info is dropped before comparing).

Amendment 3 (2026-10-31, after Dept13 FAIL v3 at e5ed683): line 7(a) amended above. Reflog: the newest
`fetch`/`pull` entry, whose new sha must equal the current `origin/main` (a newer non-fetch entry is
ignored). URLs keep their class (host URL vs local path); a local-path origin never trusts FETCH_HEAD.
Tests: `update-ref` of origin/main to a local commit after the close -> NOT POSTED; `remote rename`
origin -> o2 -> origin after the close -> NOT POSTED (and correct when a real fetch followed); a host
origin `.../dabos.git` with FETCH_HEAD from a local path `.../dabos` -> not trusted; a relative directory
named like the host URL never equals it; fetch exactly at the close ms counts (at or after). Each fix has a
mutation check. Real DABOS W44 still 232 -> 292 = 60.