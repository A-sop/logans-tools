# Acceptance: 2026-10-31 div-live W44 repost + W30 Sunday-row fold-in onto the Thu 14:00 Berlin close (Div4, not applied)

Recorded before any code for this correction (Dept13 criterion 2). Requested by Div7 2026-10-31,
applying existing rulings only: the stat week closes Thu 14:00 Europe/Berlin (org-week.ts), a stat
counts in the week the event happened, and W44 values come from the DABOS W44 stat register
(docs/registers/stats/2026-W44.md on DABOS main, Dept13-passed via DABOS #186). Built by Div4.
Model: #51 (scripts/dabos/sql/2026-10-31_supersede_div_live_w31_w43.sql) and #45/#47.
Separate from #49, #50 and #51; none of their rows or files is touched.

## Scope (read-only on DABOS prod Neon, 2026-10-31)

### Part 1: W44 repost (insert only)

div-live-2026-W44 holds 6 rows today, all superseded by #38 (2026-10-29_supersede_w44_poster_rows.sql,
reason "Dept13 FAIL 2026-10-29: ln02 poster @2474654 (ISO window, all-time qa)"), 0 active rows.
A value is posted only when the register gives a number AND its Dept13 check is a pass or a
validated value. Anything the register marks to-report (in the Value or the Dept13 check column)
stays unposted.

Posted (recorded_at 2026-10-29T12:59:59.999Z = W44 close Thu 29 Oct 14:00 CET - 1 ms, CET week):

| Division | Department | metric_key | Value | Register Dept13 check |
|---|---|---|---|---|
| Div4 | NULL | shipped_outputs | 0 | FAIL (posted 6) -> 0 validated (DABOS #196 PASS) |
| Div4 | Dept12 | shipped_outputs | 0 | same (division + Dept12 pair kept as the poster writes it; Div7 ruling) |

Not posted here:

| Division | metric | Register value | Why |
|---|---|---|---|
| Div1 | artifacts_indexed | 60 (PASS) | Posted by #49 (division row, W44 = 60). This PR writes no Div1 row in any week. |
| Div1 | search_success_rate, inbound_routed_correctly, internal_ticket_age | to-report | to-report |
| Div2 | content_pieces_shipped (Dept4), leads_or_touchpoints_created | 0 / 0 | Dept13 check to-report |
| Div3 | taxable_income_eur (Sep) | 3,049.37 | Dept13 check to-report; monthly figure, not a div-live weekly stat |
| Div5 | qa_pass_rate, validation_turnaround | to-report | to-report (Dept14 counting rule pending) |
| Div5 | compliance_open_count | 4 | Dept13 check to-report |
| Div6 | conversions, target_list_added, new_names_to_cf | to-report / 177 / 3,756 | Dept13 check to-report; Div6 posts to gfp-live, not div-live |
| Div7 | pct_hats_with_policy_text_and_battle_plan_current | 100% (21/21), PASS | FLAGGED, not posted: the div-live Div7 stat is plan_completion_rate (poster: establishment checklist reported / 21; carried-forward 28.6 in W30-W43). The register's Div7 stat is a different metric with a different value. Which key/value W44 carries is for Dept14 (already ruling on carried-forward Div5/Div7 values) and Div7. |

### Part 2: W30 Sunday-row fold-in (supersede-and-repost, #51 pattern)

div-live-2026-W30 holds 8 active rows, all at 2026-07-26T21:59:59.999Z (Sun 26 Jul 23:59:59.999
Berlin, old ISO-week end; by timestamp that is stat week W31). The 6 non-Div1 rows move to the W30
close; both Div1 rows (artifacts_indexed 75, division row and Dept3 row) stay untouched.

| id | division | department | metric | value | old recorded_at | new recorded_at |
|---|---|---|---|---|---|---|
| a8ac8685-1795-4720-be9c-215396160c82 | Div2 | NULL | leads_or_touchpoints_created | 0 | 2026-07-26T21:59:59.999Z | 2026-07-23T11:59:59.999Z |
| 498ca334-3a11-426c-9524-3da7fb29e9bf | Div2 | Dept4 | content_pieces_shipped | 0 | 2026-07-26T21:59:59.999Z | 2026-07-23T11:59:59.999Z |
| 77d44bda-75df-4941-b0f3-f9d1f9084607 | Div4 | NULL | shipped_outputs | 1 | 2026-07-26T21:59:59.999Z | 2026-07-23T11:59:59.999Z |
| 6a9c4322-63c6-4907-9c12-a96ee8869139 | Div4 | Dept12 | shipped_outputs | 1 | 2026-07-26T21:59:59.999Z | 2026-07-23T11:59:59.999Z |
| ddb587d9-08e9-4f53-9112-957df3ebf1f7 | Div5 | NULL | qa_pass_rate | 80 | 2026-07-26T21:59:59.999Z | 2026-07-23T11:59:59.999Z |
| 47cee040-8a64-44d3-8a1b-64cf6d9931c4 | Div7 | NULL | plan_completion_rate | 28.6 | 2026-07-26T21:59:59.999Z | 2026-07-23T11:59:59.999Z |

New recorded_at = recordedAtForClosedOrgWeek(statWeekWindow(2026, 30)) = Thu 23 Jul 14:00 CEST - 1 ms.
Values are not recomputed (Div5 80 / Div7 28.6 carried forward as they stand; Dept14 is ruling).

## Amendment 2026-10-31 (Dept14 ruling, 31 Oct 15:40 Berlin), recorded before the code change

Dept14 (Div5) ruled on the carried-forward Div5/Div7 values. This replaces lines 2, 3 and the
"Not posted" Div5/Div7 rows above where they differ; everything else stands.

- W30 Div5 `qa_pass_rate` 80, ddb587d9-08e9-4f53-9112-957df3ebf1f7: superseded with NO repost,
  superseded_reason exactly "Dept14 2026-10-31: all-time value, weekly count has no closed verdicts".
  W30 Div5 stays missing.
- W30 Div7 `plan_completion_rate` 28.6, 47cee040-8a64-44d3-8a1b-64cf6d9931c4: superseded with NO
  repost, superseded_reason exactly "Dept14 2026-10-31: void basis per Logan 4 Oct ruling".
- The other four W30 rows (Div2 x2, Div4 x2) are re-dated as before, reason unchanged.
- W44 Part 1 is unchanged (Div4 / NULL and Div4 / Dept12 shipped_outputs 0). Div7 posts no W44 row
  (ruling item 1). Div5 W44 `qa_pass_rate` 66.7 goes in a separate one-row PR, not here; its key
  (Div5 / NULL / qa_pass_rate in div-live-2026-W44) is left out of every guard in this script, so
  the two PRs apply in either order.

Amended acceptance lines (replace 2-3; line 1 reads "exactly 2 active non-Div1 rows apart from the
Div5 qa_pass_rate key"):

2. Part 2: each of the 6 listed W30 rows is still present with value, workspace, division,
   department, metric, basis and recorded_by unchanged and superseded_at set. superseded_reason is
   this script's W30 re-date reason for the 4 Div2/Div4 rows (distinct from #51's), and the
   matching Dept14 reason above for ddb587d9 and 47cee040. Nothing is deleted.
3. Part 2: each of the 4 Div2/Div4 rows has exactly one new active row (same workspace, division,
   department, metric, value) at 2026-07-23T11:59:59.999Z, recorded_by
   'div-live-correction-2026-10-31', basis = old basis (NULL as {}) + correction tag, superseded
   row id and old recorded_at. ddb587d9 and 47cee040 have NO repost. End state: div-live-2026-W30
   has exactly 4 active non-Div1 rows, all at the W30 close, no active Div5 qa_pass_rate or Div7
   plan_completion_rate row, and both Div1 W30 rows unchanged. 6 rows carry this script's tag.
Line 5 now covers #49, #51, this PR and the Div5 W44 PR in all 24 orders, from a fresh read-only
prod snapshot. Undo is scoped to the 6 W30 ids (the Dept14 reasons are shared with #51).

## Acceptance lines (original; 2-3 replaced by the amendment above)

1. Part 1: after applying, div-live-2026-W44 has exactly 2 active non-Div1 rows: Div4/NULL and
   Div4/Dept12 shipped_outputs = 0 at 2026-10-29T12:59:59.999Z, recorded_by
   'div-live-correction-2026-10-31', basis carrying the correction tag, the register source and the
   W44 window. The 6 #38-superseded W44 rows are byte-identical. No Div1 row is written; a Div1 W44
   row from #49 (applied before or after) is left as it is.
2. Part 2: each of the 6 listed W30 rows is still present with value, workspace, division,
   department, metric, basis and recorded_by unchanged, superseded_at set and superseded_reason =
   this script's reason (distinct from #51's, so each PR's undo stays separate). Nothing is deleted.
3. Part 2: each superseded W30 row has exactly one new active row with the same workspace,
   division, department, metric and value at 2026-07-23T11:59:59.999Z, recorded_by
   'div-live-correction-2026-10-31', basis = old basis (NULL treated as {}) + correction tag,
   superseded row id and old recorded_at. End state: div-live-2026-W30 has exactly 6 active non-Div1
   rows, all at the W30 close, and both Div1 W30 rows unchanged (active, 75, old recorded_at).
4. One transaction; exact counts asserted before and after; any mismatch aborts and changes nothing.
   A second run after success changes nothing and succeeds (no-op). A partial state aborts.
5. Rows outside these 6 + 6 + 2 are byte-identical afterwards (Div1 rows incl. #49's backfill, #51's
   W31-W43 rows, gfp-live rows, everything else). Order relative to #49 and #51 does not matter:
   neither PR's guards abort because of this one, and this one's guards do not abort because of
   them (PGlite test on a read-only snapshot of prod div-live rows, all orders where the files exist).
6. Not a migration (scripts/dabos/sql/, never run by dabos:migrate). PGlite tests cover lines 1-5
   plus guard mutations; tsc and eslint pass.
7. Not applied to any database. Applying needs a Dept13 PASS and Logan's own yes to merge and apply.
