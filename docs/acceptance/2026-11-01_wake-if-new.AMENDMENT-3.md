# wake-if-new — Amendment 3 (Dept13 FAIL @20777d68 round, 5 Nov 2026)

Committed on its own, after the base acceptance + Amendments 1–2 and before any further code
on this round. Dept13 checks the build against the base acceptance as amended by this file
(and any earlier amendments). Verdict format: exact first line
`Dept13 PASS|FAIL @<full 40-hex sha>` (no CONDITIONAL).

Prior Amendment 2 points 1–3 and 5–7 remain MET. Point 4 (monotonic status_report cursor) is
tightened by A3.1 below.

## A3.1 Cursor compare normalises instant precision

`wake_cursor_max` must not raw-string-compare GitHub second-precision (`…Z`) against Neon
micro-precision (`….USZ`). Those formats disagree in the same second (`…12:00:00Z` sorts
after `…12:00:00.500000Z`), so status_report can wake forever. Both sides are normalised to
the same comparable instant (fixed fractional precision or epoch) before compare. A test
covers GitHub second-precision vs Neon micro-precision in the same second.

## A3.2 wake_psql / wake_post_webhook restore caller errexit

Those helpers must save and restore the caller's `set -e` state (not end with a bare
`set +e`). After a successful `do_wake`, runner.sh must still have errexit on. A test proves
errexit is on after a successful wake helper.
