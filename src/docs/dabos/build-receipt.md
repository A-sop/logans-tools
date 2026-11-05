# Build hand-off receipts (Div4)

Zero-token OUT-basket receipts for agent builds. Stacked on comm-center baskets (#66) and
status digest (#61). Acceptance:
`docs/acceptance/2026-11-01_build_receipts_open_orders_stall.ACCEPTANCE.md`
(+ AMENDMENT-1, AMENDMENT-2).

## CLI

```
npm run dabos:build-receipt -- start --order-id <id> --repo <r> --branch <b> \
  --machine <m> --expected-finish <ISO> [--pr <url>]...
npm run dabos:build-receipt -- finish --order-id <id> --status done|failed [--pr <url>]...
npm run dabos:build-receipt -- route-stalls
npm run dabos:route-stalls
```

Idempotent via `ingest_source='build-receipt'` + `ingest_external_id='<order_id>:<phase>'`.

Requires `DABOS_BUILD_RECEIPT_DATABASE_URL` (no fallback to `DATABASE_URL`).

## Digest (display only)

The status digest gains an **Open orders** section: one line per order still open (from start
until 24 h after finish) as `running` | `done` | `stalled`. Stalled lines include
`reason no-receipt`. The digest role is SELECT-only and never routes stalls.

## Stall alarm (separate job)

Stalled orders (start receipt, no finish, now past `expected_finish` or `clear_by`) are routed
to Dept2 IN with `ingest_source='dept2-stall'` and `ingest_meta.reason='no-receipt'` (plus
repo, branch, machine) at most once per order per Berlin day by `dabos:route-stalls` under
role `dabos_build_receipt`. Routing never sets `basket='pending'`. Existing #66 P4 stall
`rule` values are unchanged.

## SQL (files only)

Optional grants: `scripts/dabos/sql/2026-11-01_build_receipt_role_grants.sql` (and `.UNDO.sql`).
Not applied by this PR. Guards refuse PUBLIC CREATE but not PUBLIC TEMPORARY; match the #61
column / FDW / parameter / `has_any_column_privilege` standard.

---

## Runbook: HZR52 wrapper

| | |
|---|---|
| Machine | **HZR52** (interactive; not scheduled) |
| Owner post | **Dept12 Production (Div4)** |
| Script | `ops/cli-jobs/run-with-build-receipt.ps1` |
| Schedule | none — operator launches per build |
| Env file | `~/.config/dabos/build-receipt.env` (Windows: `%USERPROFILE%\.config\dabos\build-receipt.env`), mode restricted |
| Env var names | `DABOS_BUILD_RECEIPT_DATABASE_URL` only (value never printed) |

**Run (example):**

```powershell
ops/cli-jobs/run-with-build-receipt.ps1 `
  -OrderId 'ord-…' -Repo 'A-sop/logans-tools' -Branch 'div4/…' `
  -Machine 'HZR52' -ExpectedFinish '2026-11-01T23:00:00+01:00' `
  -WorkDir 'C:\Dev\lt-build-receipts' -PromptFile 'C:\path\to\prompt.md'
```

Writes start before the agent, finish after exit (`done` if exit 0 else `failed`). Agent
stdout/stderr stay under `%TEMP%\build-receipt-<order>\` for the operator to inspect; the
wrapper does not echo the agent argument list.

**On failure:** check finish status in Neon (`ingest_source='build-receipt'`), fix the agent
or env file, re-run. Owner: Dept12 Production (Div4).

---

## Runbook: ln02 route-stalls job

| | |
|---|---|
| Machine | **ln02** only (never the LDW laptop) |
| Owner post | **Dept12 Production (Div4)** |
| Schedule | hourly `*-*-* *:00:00 Europe/Berlin` (`Persistent=true`) |
| Units | `scripts/dabos/ln02/dabos-route-stalls.{service,timer}` |
| Install | `scripts/dabos/ln02/install-route-stalls.sh` (dry run unless `--apply`) |
| npm | `npm run dabos:route-stalls` |
| Env file | `~/.config/dabos/build-receipt.env`, mode 600 |
| Env var names | `DABOS_BUILD_RECEIPT_DATABASE_URL` (role `dabos_build_receipt`) |

**Install / undo (files only until Logan's yes after Dept13 PASS):**

```bash
scripts/dabos/ln02/install-route-stalls.sh            # dry run
scripts/dabos/ln02/install-route-stalls.sh --apply    # after PASS + yes
# undo: systemctl --user disable --now dabos-route-stalls.timer
#       rm ~/.config/systemd/user/dabos-route-stalls.{service,timer}
#       systemctl --user daemon-reload
```

**On failure:** `journalctl --user -u dabos-route-stalls -n 50` on ln02; confirm the env file
name is set (not the value); re-run `systemctl --user start dabos-route-stalls.service`.
Owner: Dept12 Production (Div4).
