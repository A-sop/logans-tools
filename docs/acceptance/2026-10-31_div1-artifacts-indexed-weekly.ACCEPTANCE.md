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
     Git is used only when `origin/main` was fetched at or after the close: a reflog entry of
     `refs/remotes/origin/main` at or after the close, or a `FETCH_HEAD` (this worktree's) modified
     at or after the close whose `branch 'main'` line names the current `origin/main` commit.
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
