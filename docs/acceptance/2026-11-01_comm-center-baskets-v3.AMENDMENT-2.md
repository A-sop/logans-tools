# Comm center v3 — Amendment 2 (Dept13 FAIL @2cd4cc2b round, 1 Nov 2026)

Committed on its own, after the base acceptance + Amendment 1 and before any further code on
this round. Dept13 checks the build against the base acceptance as amended. Verdict format:
exact first line `Dept13 PASS|FAIL @<full 40-hex sha>` (no CONDITIONAL).

Keep (unchanged): routing never sets `basket='pending'`; P1–P6 stand.

## A2.1 Routing sets the new recipient and never re-routes to itself

Courier routing stamps route metadata (`routed_at` / `routed_from` as needed), sets the new
recipient, and must not leave a `to` that sends the row back to the same inbox forever.
A test covers a full round trip (OUT → recipient IN → hat receipt OUT → no re-delivery loop).

## A2.2 Already-filed / done rows are not re-delivered

Courier excludes rows with `filed_at` (and already-routed / done-out rows as designed) so a
filed OUT row is never moved back to IN. A test covers this.

## A2.3 Normalise maps known prod values; reports remaining unmapped clearly

`_agent_map` includes:
- `dept03-perception-stats` → Div1 Dept3
- `Div4 Technical Secretary` → Div4
- `DIV VI PUBLIC` → Div6

Before aborting, the migration reports any remaining unmapped `assigned_agent` values clearly.
A test is fed with prod's actual distinct unmapped values (at least the three above).

## A2.4 Secrets not on process argv

Same bar as wake-if-new: curl must not put the webhook key on argv; psql must not take a
password URL as argv (`PGPASSFILE` / service file or env, not argv).

## A2.5 Env file is not shell-sourced; mode 600 enforced

Comm-center env is parsed as literal `KEY=VALUE` (no shell `source`). Load refuses a file
whose mode is wider than `600` or whose owner is not the current user.
