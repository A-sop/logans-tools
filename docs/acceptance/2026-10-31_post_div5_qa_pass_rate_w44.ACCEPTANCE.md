# Acceptance: 2026-10-31 Div5 W44 qa_pass_rate = 70.0 (Dept14 ruling), one guarded insert (Div4, not applied)

Recorded before any code for this correction (Dept13 criterion 2). Requested by Dept14 (Div5) in
its ruling of Sat 31 Oct 2026, 15:40 Berlin, item 3. Built by Div4. Model: #53
(scripts/dabos/sql/2026-10-31_repost_div_live_w44_and_w30_close.sql) and #51. Separate from #49,
#50, #51 and #53; none of their rows or files is touched, and none of their keys is read here.

## The value

Div5 `qa_pass_rate` for stat week W44 (Thu 22 Oct 14:00 CEST to Thu 29 Oct 14:00 CET Berlin;
2026-10-22T12:00:00Z to 2026-10-29T13:00:00Z) = **70.0** = 21 / 30.

Rule (Dept14 2026-10-31): closed Dept13 verdicts (PASS or FAIL) in stat week W44, one per verdict
event (one verdict on one PR at one SHA), dated by when Div5 sent the verdict, from all 47 W44
events in the Dept13 validation register W44 rebuild (Instances 6-26 and 36-61; DABOS #201
@651c1c6c0c2782595217dad8a8b394b06c0e1a02, on DABOS main 248056df). Not-closed verdicts
(CONDITIONAL, PASS-conditional) excluded.

| | Instances | Count |
|---|---|---|
| PASS (numerator) | 6, 8, 9, 10, 11, 12, 14, 16, 19, 20, 21, 23, 25, 26, 39, 44, 49, 54, 58, 59, 60 | 21 |
| FAIL | 7, 13, 17, 18, 22, 24, 40, 42, 51 | 9 |
| Closed verdicts (denominator) | | 30 |
| Excluded, PASS-conditional | 15 (#172, merge #171 first), 61 (#179 @89141e1e, conditions before recreating calcom) | 2 |
| Excluded, CONDITIONAL | 36, 37, 38, 41, 43, 45, 46, 47, 48, 50, 52, 53, 55, 56, 57 | 15 |
| All W44 verdict events | | 47 |

Instance 25 (#180 @389600c8) counts: the PASS was sent in the 21:49 turn, before the 21:50 merge
"from validated head 389600c8".

Rounded as the poster rounds (one decimal): round(21 / 30 * 1000) / 10 = 70.0.

## The row

One new row: workspace div-live-2026-W44, Div5, department NULL, metric qa_pass_rate, value 70.0,
recorded_at 2026-10-29T12:59:59.999Z (W44 close Thu 29 Oct 14:00 CET - 1 ms, org-week.ts
recordedAtForClosedOrgWeek(statWeekWindow(2026, 44))), recorded_by
'div-live-correction-2026-10-31', basis jsonb with: correction tag, numerator 21, denominator 30,
the rule above, the register source (DABOS #201 head sha), the included PASS and FAIL instances,
the excluded instances (15 and 61 PASS-conditional, the 15 CONDITIONALs) with why, and
"Dept14 ruling 2026-10-31", plus year/week/window. The #38-superseded W44 Div5 row
(2683a636-bb19-46f4-a800-1f73d5ba16ed, 75) stays as it is.

## Amendment 2026-10-31 (W44 rebuild), recorded before the code change

Div7/Dept19 FAILed the first version of this PR (12 / 18 = 66.7): its basis used only the backfill
Instances 6-25, built from commit labels and battle-plan notes. Div5 rebuilt W44 from its own
verdict messages (47 events; DABOS #201 @651c1c6c0c2782595217dad8a8b394b06c0e1a02). The value,
instance lists and basis above are restated from that rebuild: 70.0 = 21 / 30. Guard 0b checks
round(21 * 1000 / 30) / 10 = 70.0. The row, key, close, tag, recorded_by and every other line stand.
Mutation checks: dropping Instance 25 (20 / 29 = 69.0) or counting 61 as PASS (22 / 31 = 71.0) must
fail.

## Acceptance lines

1. After applying, div-live-2026-W44 has exactly one active Div5 / NULL / qa_pass_rate row: the
   new row above, value 70.0, at 2026-10-29T12:59:59.999Z, basis numerator 21 and denominator 30.
   Exactly one row carries this script's correction tag.
2. Before inserting, the script asserts that no active Div5 qa_pass_rate W44 row exists and that
   the only Div5 qa_pass_rate W44 row is the #38-superseded 2683a636 (75, #38's reason). It reads
   no other key, so #49, #51 and #53 can be applied before or after it.
3. Every other row is byte-identical afterwards (md5 inside the transaction).
4. One transaction; exact counts asserted; any mismatch aborts and changes nothing. A second run
   after success changes nothing and succeeds (no-op). A tagged row that was later superseded or
   changed aborts.
5. Order does not matter against #49, #51 and #53 (PGlite order test on a fresh read-only prod
   snapshot, all 24 orders, in #53).
6. Not a migration (scripts/dabos/sql/, never run by dabos:migrate). PGlite tests cover lines 1-4
   plus guard mutations; tsc and eslint pass.
7. Not applied to any database. Applying needs a Dept13 PASS and Logan's own yes to merge and apply.
