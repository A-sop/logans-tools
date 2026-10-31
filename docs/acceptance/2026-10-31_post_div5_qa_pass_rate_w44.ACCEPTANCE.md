# Acceptance: 2026-10-31 Div5 W44 qa_pass_rate = 66.7 (Dept14 ruling), one guarded insert (Div4, not applied)

Recorded before any code for this correction (Dept13 criterion 2). Requested by Dept14 (Div5) in
its ruling of Sat 31 Oct 2026, 15:40 Berlin, item 3. Built by Div4. Model: #53
(scripts/dabos/sql/2026-10-31_repost_div_live_w44_and_w30_close.sql) and #51. Separate from #49,
#50, #51 and #53; none of their rows or files is touched, and none of their keys is read here.

## The value

Div5 `qa_pass_rate` for stat week W44 (Thu 22 Oct 14:00 CEST to Thu 29 Oct 14:00 CET Berlin;
2026-10-22T12:00:00Z to 2026-10-29T13:00:00Z) = **66.7** = 12 / 18.

Rule (Dept14 2026-10-31): closed Dept13 verdicts (PASS or FAIL) in W44 by commit time, one count
per verdict event, taken from the Dept13 validation register backfill, Instances 6-25 (DABOS #191,
DABOS main 248056df). Instances #15 and #25 are excluded as not closed.

| | Instances | Count |
|---|---|---|
| PASS (numerator) | 6, 8, 9, 10, 11, 12, 14, 16, 19, 20, 21, 23 | 12 |
| FAIL | 7, 13, 17, 18, 22, 24 | 6 |
| Closed verdicts (denominator) | | 18 |
| Excluded, not closed | 15 (PASS conditional on #171), 25 (W44 only if pre-merge) | 2 |

Rounded as the poster rounds (one decimal): round(12 / 18 * 1000) / 10 = 66.7.

## The row

One new row: workspace div-live-2026-W44, Div5, department NULL, metric qa_pass_rate, value 66.7,
recorded_at 2026-10-29T12:59:59.999Z (W44 close Thu 29 Oct 14:00 CET - 1 ms, org-week.ts
recordedAtForClosedOrgWeek(statWeekWindow(2026, 44))), recorded_by
'div-live-correction-2026-10-31', basis jsonb with: correction tag, numerator 12, denominator 18,
the rule, the included PASS and FAIL instances, the excluded instances 15 and 25 with why, and
"Dept14 ruling 2026-10-31", plus year/week/window. The #38-superseded W44 Div5 row
(2683a636-bb19-46f4-a800-1f73d5ba16ed, 75) stays as it is.

## Acceptance lines

1. After applying, div-live-2026-W44 has exactly one active Div5 / NULL / qa_pass_rate row: the
   new row above, value 66.7, at 2026-10-29T12:59:59.999Z, basis numerator 12 and denominator 18.
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
