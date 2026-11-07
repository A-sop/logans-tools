# wake-if-new — Amendment 2 (Dept13 FAIL @4ddf5661 round, 1 Nov 2026)

Committed on its own, after the base acceptance and before any further code on this round.
Dept13 checks the build against the base acceptance as amended by this file (and any earlier
amendments). Verdict format: exact first line `Dept13 PASS|FAIL @<full 40-hex sha>` (no CONDITIONAL).

## A2.1 Cursor must not be corrupted by whitespace stripping

Check modules that read a timestamptz from psql must not strip interior spaces (e.g.
`${MAX//[[:space:]]/}` on `2026-11-01 22:40:30…`). SQL must emit an ISO-8601 UTC cursor
(e.g. `to_char(… AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`). A test exercises
real-style psql output (space between date and time) and proves the stored cursor stays valid.

## A2.2 Failed wake does not advance the cursor

`do_wake` advances the cursor only after a successful webhook POST (HTTP 2xx). Missing URL/key
or a failed POST keeps the previous `STATE_CURSOR` (and per-source cursors). A test covers this.

## A2.3 morning_brief: separate cursors per source

`morning_brief` must not share one cursor across timestamp sources and the mail UID source.
State holds a cursor per source (telegram / mail / status). A test covers mixed types.

## A2.4 status_report cursor is monotonic

When combining Neon max and GitHub newest, the outgoing cursor is the later of the two
(never moves backwards). A test covers an older GitHub time not overriding a newer Neon max.

## A2.5 Secrets not on process argv

Webhook curl must not put the bearer key or URL on the visible command line (use curl
`--config` / `-H @file` or stdin). psql must not take a password URL as argv (use
`PGPASSFILE` / service file or `PGPASSWORD` env, not argv).

## A2.6 Env file is not shell-sourced; mode 600 enforced

`wake-if-new.env` is parsed as literal `KEY=VALUE` lines (no `.` / `source`, no expansion of
`$`, backticks, or command substitution). Load refuses a file whose mode is wider than `600`
or whose owner is not the current user.

## A2.7 Scripts committed executable

All runnable files under `ops/ln02/wake-if-new/` are git mode `100755`. A test asserts this
via `git ls-files -s` (or equivalent).
