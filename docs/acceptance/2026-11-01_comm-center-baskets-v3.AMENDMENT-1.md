# Comm center v3 — Amendment 1 (routing never PENDING, 1 Nov 2026)

Committed on its own, after the base acceptance and before any further code on this round.
Dept13 checks the build against the base acceptance as amended by this file.
Verdict format: exact first line `Dept13 PASS|FAIL @<full 40-hex sha>` (no CONDITIONAL).

## A1 Routing does not set PENDING

A routed despatch never sets `basket='pending'`. The courier moves the sender's `out` row
to the receiving post's `in`. PENDING remains only "looked at, can't be dealt with yet" and
still requires `reason` + `waiting_on` (P1).

Do **not** carry over the founder-desk CHAT-DRAIN.md L23 trigger that moved a row to pending
"when it is routed".

Tests prove: courier routing sets the addressee basket to `in` (never `pending`), and the
route UPDATE path in the courier script does not assign `basket='pending'`.
