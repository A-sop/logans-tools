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
7. Sources, in order: (a) git history of `DABOS_REPO_ROOT` when its working-tree index equals the index
   at the git ref (first-parent history, committer time, so the week a change landed on the branch);
   (b) otherwise (e.g. ln02, whose Seagate mirror excludes `.git`) the previous stat week's Div1 row
   fingerprints as the start baseline and the current index file as the end, refused if the file was
   modified at or after the close.
8. Tests: the new tests fail on main (mutation check); targeted tests, full vitest, tsc and eslint on
   touched files pass.
9. No merge without Dept13 PASS and Logan's own yes. After merge ln02 must pull main before
   Thu 5 Nov 14:30 Berlin. #32 is not closed here; its branch history still holds the leaked fixture.
