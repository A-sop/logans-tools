# Acceptance: 2026-10-31 Div1 artifacts_indexed backfill, div-live W31-W44 (Div4, not applied)

Recorded before any code for this correction (Dept13 criterion 2). Requested by Div7 2026-10-31
(Div1 rows missing from prod because the ln02 week-close poster never emitted Div1; the emitter fix
is a separate PR). Built by Div4. Model: scripts/dabos/sql/2026-10-31_supersede_gfp_live_w43_w44.sql (#45)
and the W27-W42 correction (#47). Separate from #47; #47 is not touched.

Rules applied (existing, no new ruling): the stat week closes Thu 14:00 Europe/Berlin (org-week.ts);
a stat counts in the week the event happened; Div1 artifacts_indexed = unique pages linked from
DABOS docs/wiki/index.md (Logan ruling 2026-10-21, same normalisation as #32's
countUniqueWikiPages); the weekly value is the pages ADDED during the stat week
(Thu 14:00 -> Thu 14:00 Berlin), i.e. unique count at the close minus unique count at the
previous close. A re-pointed link adds no page.

Basis of "the index at a close": docs/wiki/index.md on A-sop/DABOS main as published on GitHub at
the closing Thursday 14:00 Berlin. History is NOT read first-parent-only: a sync merge of GitHub
main into a stale local copy ("Merge origin/main ...", "Merge branch 'main' of
https://github.com/A-sop/DABOS") has GitHub main as its SECOND parent, so the walk follows parent 2
at those merges (abf625a1, 133ea3be, 1025d6c7, 72baf3c7).

## Acceptance lines

1. After applying, each workspace div-live-2026-W31 .. div-live-2026-W44 has exactly one row with
   division_id 'Div1', department_id NULL, metric_key 'artifacts_indexed' (14 rows), with the value
   in the table below and recorded_at = that week's Thu 14:00 Berlin close minus 1 ms
   (recordedAtForClosedOrgWeek(statWeekWindow(2026, n))): 11:59:59.999Z for W31-W43 (CEST),
   12:59:59.999Z for W44 (CET, 2026-10-29).
2. Each inserted row's basis names the Div1 basis (pages added to docs/wiki/index.md during the stat
   week, Thu 14:00 -> Thu 14:00 Berlin, event-week rule), the window, the unique count before and
   after, the DABOS main commit at the close, and the correction tag.
3. Inserts are guarded by WHERE NOT EXISTS on (workspace_id, division_id, department_id IS NOT
   DISTINCT FROM NULL, metric_key), the same key as emitStat insert_if_absent. Running the script a
   second time inserts nothing and succeeds. An existing Div1 artifacts_indexed division row in
   W31-W44 with a different value or recorded_at aborts the whole script (nothing changed).
4. Both existing div-live-2026-W30 Div1 artifacts_indexed rows (value 75, old artifact-index.md
   basis; one division row, one Dept3 row) are not altered, superseded, deleted or duplicated.
   No row outside the 14 inserted ones changes.
5. One transaction; any guard failure aborts and changes nothing. Not a migration (lives under
   scripts/dabos/sql/, never run by dabos:migrate).
6. PGlite tests cover lines 1-5, including W38 = 3, W40 = 0, W42 = 0 and exactly 14 rows; full vitest, tsc and eslint
   pass.
7. Not applied to any database. Applying needs a Dept13 PASS and Logan's own yes to merge and apply.
8. (Dept13 request, 2026-10-31) The W44 row's basis also carries the end-of-week page fingerprints in
   the format #50 reads as the W45 snapshot start: `page_fingerprints` = sorted array of
   sha256(normalised target) first 16 hex, one per unique page linked from docs/wiki/index.md on
   GitHub main at the W44 close (37aff075; 292 entries = index_unique_after), and
   `fingerprint_rule` = #50's rule string. Hashes only, never page names. W31-W43 rows carry no
   fingerprints. A malformed list (not 292 distinct sorted 16-hex values) aborts the script.
   #50's loader query (previous week, Div1, department NULL, artifacts_indexed, not superseded)
   returns exactly this list.

## Values (verified 2026-10-31 from a fresh read-only clone of A-sop/DABOS)

| Week | Window (Berlin) | Unique before | Unique after | Value | DABOS main at close |
|---|---|---|---|---|---|
| W31 | Thu 23 Jul 14:00 -> Thu 30 Jul 14:00 | 218 | 218 | 0 | 5bd5a00b |
| W32 | 30 Jul -> 6 Aug | 218 | 227 | 9 | d2fb4bfb (a82f5f6e, 3 Aug) |
| W33 | 6 Aug -> 13 Aug | 227 | 227 | 0 | 72baf3c7 |
| W34 | 13 Aug -> 20 Aug | 227 | 229 | 2 | f7cb1800 (d5293918, 15 Aug) |
| W35 | 20 Aug -> 27 Aug | 229 | 229 | 0 | 000d2f2e |
| W36 | 27 Aug -> 3 Sep | 229 | 229 | 0 | b92b8e64 |
| W37 | 3 Sep -> 10 Sep | 229 | 229 | 0 | a21c2dda |
| W38 | 10 Sep -> 17 Sep | 229 | 232 | 3 | eef8b6e5 (2e1696fe, Fri 11 Sep 00:19 Berlin) |
| W39 | 17 Sep -> 24 Sep | 232 | 232 | 0 | f85b987f |
| W40 | 24 Sep -> 1 Oct | 232 | 232 | 0 | a49b6d10 |
| W41 | 1 Oct -> 8 Oct | 232 | 232 | 0 | 6dc58670 |
| W42 | 8 Oct -> 15 Oct | 232 | 232 | 0 | 7814e757 (dea83ac1, 9 Oct, re-point only) |
| W43 | 15 Oct -> 22 Oct | 232 | 232 | 0 | 368cfd9e |
| W44 | 22 Oct -> Thu 29 Oct 14:00 CET | 232 | 292 | 60 | 37aff075 (19190099 via DABOS #112, merged 23 Oct) |

W44 = 60 matches the Dept13-passed register (DABOS 2026-W44.md via #186). 19190099's commit message
says "231->291"; the index itself counts 232 -> 292 unique targets (237 -> 297 table rows).

W38 = 3, W40 = 0 (amended after Dept13 FAIL v1 on d851f16; v1 had W38 = 0, W40 = 3 on a misread
"merge-time" basis). 2e1696fe (Thu 10 Sep 22:19Z = Fri 11 Sep 00:19 Berlin, "Collapse mail
open-loops onto vendor SSOTs and land the 400 FK host-gift card.") took the index 229 -> 232
(two youtube source pages + concepts/koerner-foot-in-door-400fk.md) and was on GitHub main from
then: 36fa8134 (17 Sep) and eef8b6e5 (17 Sep, GitHub main at the W38 close, 232 unique) build on it.
133ea3be (Tue 29 Sep 12:42 Berlin, "Merge origin/main; keep session-log End for paperless ingest.")
did NOT bring the pages to main: it merged GitHub main (parent 2, ca868487, which already contains
2e1696fe) into a stale local copy (parent 1, e7c26854 on b92b8e64 of 2 Sep, which does not).
Following first parents through 133ea3be misreads main between 2 and 29 Sep. Re-verified
2026-10-31 on a fresh read-only clone walking parent 2 at sync merges: W37 close 229 (a21c2dda),
W38 close 232 (eef8b6e5), W39 and W40 closes 232. The sum stays 74.

W42 = 0, not 1 (Div7's draft value; decision 2026-10-31 applying the existing pages-added rule).
dea83ac1 (Fri 9 Oct 15:14 Berlin, "Point reference stubs at their department homes.") changed one
line of docs/wiki/index.md: the "Vercel static marketing (best practice)" row's link moved from
../reference/vercel-static-marketing-best-practice.md to
../reference/dept11-engineering/vercel-static-marketing-best-practice.md. One target added, one
removed, same page: unique 232 -> 232, rows 237 -> 237. No page was added in W42.

Out of scope: the W30 rows (old basis), Dept3 department rows for W31-W44 (open question for Div7;
the old poster wrote a Dept3 row next to the division row in W30), the Div1 emitter (separate PR),
and the five workspace-less Div1 artifacts_indexed rows from June/July.