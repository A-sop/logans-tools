# Acceptance: 2026-10-31 Div1 artifacts_indexed void basis W24-W28 + W30 repost on the current rule (Div4, not applied)

Recorded before any code for this correction (Dept13 criterion 2). Ruling: Dept14, 31 Oct 2026
17:45 Berlin. Built by Div4. Model: #49 (Div1 row shape and basis,
scripts/dabos/sql/2026-10-31_backfill_div1_artifacts_indexed_w31_w44.sql) and #51/#53 (supersede in
place, never delete).

Rules applied: Div1 artifacts_indexed counts unique normalised link targets ADDED to DABOS
docs/wiki/index.md during the stat week, as a set difference |targets at the close \ targets at the
previous close|, removals not subtracted (Logan ruling 2026-10-21 "unique link targets"; Dept14
2026-10-31; same rule as #49 and #50). The stat week closes Thu 14:00 Europe/Berlin (org-week.ts).
The index at a close is read on A-sop/DABOS main as published on GitHub at that close, following
parent 2 at sync merges (as #49). Div7: Div1 has no Dept3 rows.

## Scope

Part 1, supersede with NO repost: the 5 active Div1 / NULL / artifacts_indexed rows with
workspace_id NULL (the 7 Jul backfill of registry and log counts), with reason
"Dept14 2026-10-31: void basis per Logan 21 Oct ruling (7 Jul backfill of registry and log counts, not wiki pages added per stat week)":

| Week | id                                   | value | recorded_at              |
| ---- | ------------------------------------ | ----- | ------------------------ |
| W24  | e764a5dd-1244-4cae-82b7-dc1a9b731627 | 2277  | 2026-06-11T12:00:00.000Z |
| W25  | eb1e15a5-96ca-4c05-ab37-87559c4fbdf3 | 592   | 2026-06-18T12:00:00.000Z |
| W26  | acadbebe-01ce-4ac7-8ad5-085cc68809a2 | 89    | 2026-06-25T12:00:00.000Z |
| W27  | 6fdac124-4488-44c9-a974-b0144a58458d | 128   | 2026-07-02T12:00:00.000Z |
| W28  | 73a818d5-0e87-4515-8975-62a5341edb68 | 393   | 2026-07-09T12:00:00.000Z |

Part 2, W30: supersede both active div-live-2026-W30 Div1 artifacts_indexed rows (75 at
2026-07-26T21:59:59.999Z, week-close-poster, artifact-index register basis) with reason
"Dept14 2026-10-31: void basis per Logan 21 Oct ruling (artifact-index register count)":
dd2b66e2-1390-44b2-b2a4-d1829ff09400 (Dept3) and 252780ef-4988-428a-ad3b-5eb6a6cf43db (division); the guard pins their basis by md5 as read on prod
(425fe92f322d67bf1f810cfb29b1328e and 6f6139ecf5cbfb94289272c706d9fe9d).
Then post ONE row: div-live-2026-W30 / Div1 / department NULL / artifacts_indexed = **0**,
recorded_at 2026-07-23T11:59:59.999Z (recordedAtForClosedOrgWeek(statWeekWindow(2026, 30)), Thu
23 Jul 14:00 CEST - 1 ms), recorded_by week-close-poster (as #49). No Dept3 row.

W30 value (verified 2026-10-31 on a fresh read-only clone of A-sop/DABOS):

| Close                      | GitHub main                              | Unique targets |
| -------------------------- | ---------------------------------------- | -------------- |
| W29, Thu 16 Jul 14:00 CEST | 697c0095014529a4453a7eae0cd5ae76842109d7 | 218            |
| W30, Thu 23 Jul 14:00 CEST | 697c0095014529a4453a7eae0cd5ae76842109d7 | 218            |

Added 0, removed 0. No sync merge on the main line in July. No commit touched the index between 8
and 31 Jul; the newest index commit before both closes is 353fd4b0 (1 Jul). W31's close (5bd5a00b, 218) matches #49's W31 start.

## Acceptance lines

1. After applying, the 5 workspace-less rows and the 2 W30 rows above are superseded in place
   (superseded_at set, superseded_reason = the exact reason of their part); no other column of
   theirs changes; none is deleted; none of the 5 is reposted.
2. After applying, div-live-2026-W30 has exactly one active Div1 artifacts_indexed row: department
   NULL, value 0, recorded_at 2026-07-23T11:59:59.999Z, recorded_by week-close-poster. Its basis has
   #49's keys (ssot, rule, note, year, week 30, window 2026-07-16T12:00Z -> 2026-07-23T12:00Z,
   index_unique_before 218, index_unique_after 218, index_targets_removed 0, dabos_main_at_close
   697c0095, correction tag) plus the set-difference method, git_start_commit and git_end_commit
   (GitHub main at the W29 and W30 closes), the superseded ids and the Dept14 ruling. No active Div1
   Dept3 row in W30; no active workspace-less Div1 artifacts_indexed row.
3. Guards abort the whole script (nothing changed) on any mismatch: the 7 rows' exact ids, keys,
   values, recorded_at, recorded_by and basis before the change; an unlisted workspace-less Div1
   artifacts_indexed row or Div1 W30 row; any change to a row outside the 7 + the 1 new one
   (md5 over the whole table apart from the targeted rows); row deltas other than total +1,
   active -6; an end state other than line 2.
4. Deltas: superseding is an in-place UPDATE (the #51/#53 pattern), so it adds no rows. Total +1,
   active -6. On prod as of 31 Oct 17:42 CET: 186 -> 187 rows, 138 -> 132 active; div-live 84 -> 85
   rows, 42 -> 41 active.
5. A re-run after success writes nothing and succeeds. A partial state aborts.
6. The undo in the SQL header (delete the tagged row; clear the supersede columns of the 7 listed ids
   with the 2 exact reasons) restores the table exactly, and touches no other row.
7. Order: with #54 (not applied), either order gives the same end state, no double-live key, and
   re-runs are no-ops. Seeded from a fresh read-only snapshot of prod (all div-live rows plus the 5
   workspace-less rows). From the 15:40 snapshot, #49, #51, #53, #54 in any order, followed by this
   script at any point after #53, end in the same state. Run before #53, #53 aborts unchanged at its
   guard 1c (it pins both W30 Div1 rows at 75); a re-run of #53 after this script aborts unchanged at
   its guard 5d for the same reason.
8. One transaction; not a migration (scripts/dabos/sql/). PGlite tests cover lines 1-7 with
   mutations; tsc, eslint and prettier pass.
9. Not applied to any database. Applying needs a Dept13 PASS and Logan's own yes to merge and apply.
