# Acceptance: 2026-10-31 div-live W31-W43 supersede-and-repost onto the Thu 14:00 Berlin close (Div4, not applied)

Recorded before any code for this correction (Dept13 criterion 2). Requested by Div7 2026-10-31,
applying existing rulings only: the stat week closes Thu 14:00 Europe/Berlin (org-week.ts) and a
stat counts in the week the event happened. Built by Div4. Model: #45
(scripts/dabos/sql/2026-10-31_supersede_gfp_live_w43_w44.sql) and #47 (gfp-live W27-W42).
Separate from #47, #49 and #50; none of their rows or files is touched.

## Scope (read-only on DABOS prod Neon, 2026-10-31)

Non-Div1 div-live rows in W31-W43 exist only in div-live-2026-W31, W40, W41, W42, W43: 6 active rows
each (Div2 leads_or_touchpoints_created, Div2/Dept4 content_pieces_shipped, Div4 shipped_outputs,
Div4/Dept12 shipped_outputs, Div5 qa_pass_rate, Div7 plan_completion_rate), 30 in total, all with
recorded_by NULL and basis NULL, recorded_at at the old ISO-Sunday end:

| Workspace | Rows | Old recorded_at (UTC) | Berlin | New recorded_at (close - 1 ms) |
|---|---|---|---|---|
| div-live-2026-W31 | 6 | 2026-08-02T21:59:59.999Z | Sun 2 Aug 23:59:59.999 | 2026-07-30T11:59:59.999Z |
| div-live-2026-W40 | 6 | 2026-10-04T21:59:59.999Z | Sun 4 Oct 23:59:59.999 | 2026-10-01T11:59:59.999Z |
| div-live-2026-W41 | 6 | 2026-10-11T23:59:59.999Z | Mon 12 Oct 01:59:59.999 | 2026-10-08T11:59:59.999Z |
| div-live-2026-W42 | 6 | 2026-10-18T23:59:59.999Z | Mon 19 Oct 01:59:59.999 | 2026-10-15T11:59:59.999Z |
| div-live-2026-W43 | 6 | 2026-10-25T23:59:59.999Z | Mon 26 Oct 01:59:59.999 | 2026-10-22T11:59:59.999Z |

W32-W39 have no div-live rows for any division; nothing to supersede or repost there. stats has no
foreign key on workspace_id (prod has none at all besides the primary key), so no workspace rows
are created.

Week assignment: each row keeps the week of its workspace label (div-live-2026-Wnn), as the board
already does (board-conditions-query.ts bucketStatWeek: a labelled row keeps its label). Every old
recorded_at lies after that label's Thursday close, i.e. inside the NEXT stat week by timestamp;
that is the defect being corrected, not a re-labelling.

## Acceptance lines

1. After applying, each of the 30 rows listed in the script is still present, with value,
   workspace, division, department, metric, basis and recorded_by unchanged, and superseded_at set
   and superseded_reason = the script's reason. Nothing is deleted.
2. For each superseded row there is exactly one new active row with the same workspace_id,
   division_id, department_id, metric_key and value, recorded_at = its workspace label's Thursday
   14:00 Berlin close minus 1 ms (recordedAtForClosedOrgWeek(statWeekWindow(2026, n)); all
   11:59:59.999Z, CEST), recorded_by 'div-live-correction-2026-10-31', and basis = old basis (NULL
   treated as {}) plus correction tag, the superseded row id and its old recorded_at.
3. End state: each of the 5 workspaces has exactly 6 active non-Div1 rows, all at the close.
4. One transaction; exact counts asserted before and after; any mismatch aborts and changes nothing.
   A second run after success changes nothing and succeeds (no-op). A partial state aborts.
5. Rows outside the 30 are byte-identical afterwards: Div1 rows (incl. #49's backfill if applied
   first, and both W30 Div1 rows), all W30 rows, the superseded W44 rows, gfp-live rows (#45/#47),
   and everything else. Order relative to #47 and #49 does not matter.
6. Not a migration (scripts/dabos/sql/, never run by dabos:migrate). PGlite tests cover lines 1-5
   plus guard mutations; full vitest, tsc and eslint pass.
7. Not applied to any database. Applying needs a Dept13 PASS and Logan's own yes to merge and apply.

## Not done (stopped / out of scope)

- W44: the 6 div-live-2026-W44 rows were superseded with NO replacement by
  scripts/dabos/sql/2026-10-29_supersede_w44_poster_rows.sql (#38, Dept13-passed): "every W44
  division stat is to-report". No active W44 replacement row exists in any other workspace. This
  PR does not repost W44.
- Values are not recomputed. They were posted on the old ISO Mon-Sun window (no basis recorded);
  this correction only moves recorded_at onto the Thursday close of the labelled week.
- Div1 (no Dept3 rows, per Div7), W30, W32-W39 (no rows), Div3/Div6.