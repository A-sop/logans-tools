# Build receipts / stall alarm — Amendment 1 (Dept13 FAIL @15d9a0c, 1 Nov 2026)

Committed on its own, after the base acceptance and before any further code on this fix
round. Dept13 checks the build against the base acceptance as amended by this file.
Verdict format: exact first line `Dept13 PASS|FAIL @<full 40-hex sha>` (no CONDITIONAL).

Source: Dept13 FAIL on logans-tools #67 @15d9a0c6e63523cf9f10ed2598bc6a4b50a27476
(review https://github.com/A-sop/logans-tools/pull/67#pullrequestreview-5730469205).

## A1 Stall alarm is not inside the digest

`collectDigestInput` / the status digest must **not** call `routeStalledBuildOrders` or
otherwise INSERT. The digest role (`dabos_status_digest`) stays SELECT-only on `tasks` and
only **displays** Open orders (`running` | `done` | `stalled`).

Stall routing runs as its own entrypoint/job under role `dabos_build_receipt`:
`build-receipt route-stalls` (dedicated npm script + ln02 systemd service/timer files only,
not installed by this PR). Tests prove the digest path attempts no writes, and that
route-stalls succeeds under the receipt role's grants.

## A2 Dedicated database URL (no DATABASE_URL fallback)

`scripts/dabos/build-receipt.ts` (and route-stalls) reads only
`DABOS_BUILD_RECEIPT_DATABASE_URL`. If unset, exit non-zero with a clear message. No
fallback to `DATABASE_URL` / `DATABASE_URL_UNPOOLED` / `.env.local` owner URL. Named in
the grants SQL header and the runbook; Logan places the value; code never prints it.
Tested.

## A3 Grants guards match the #61 standard

`2026-11-01_build_receipt_role_grants.sql` ports the full #61 guard set that was missing:
column grants (`pg_attribute.attacl`), FDW / foreign server / large-object ACLs,
`pg_parameter_acl`, and `has_any_column_privilege` in the effective-privilege loop. Keep:
refuse PUBLIC CREATE but **not** PUBLIC TEMPORARY; membership checks use `member = role`
(PG16+ CREATEROLE creator ADMIN allowed). Tests for each (including column-grant refusal
and guard 0 when the role is missing).

## A4 Runbook entries (harness before model/tool)

`src/docs/dabos/build-receipt.md` names machine, owner post, schedule, install/run
commands, env file path `~/.config/dabos/build-receipt.env`, and env var **names** only for:

- HZR52 wrapper `ops/cli-jobs/run-with-build-receipt.ps1` (interactive, not scheduled;
  owner Dept12 Production (Div4));
- ln02 route-stalls job (never the LDW laptop; owner Dept12 Production (Div4); timer +
  service + dry-run-by-default install script, files only).

## A5 PowerShell wrapper argument quoting

`run-with-build-receipt.ps1` must not pass the agent prompt / paths with spaces via
`Start-Process -ArgumentList` array items (those split on spaces). Quote/escape each
argument correctly (call operator with discrete args, or one properly quoted argument
string). A Pester or script test proves a prompt with spaces and a path with spaces
arrive as single arguments on pwsh 7.4 and Windows PowerShell 5.1 where available; exit 0
→ finish `done`, non-zero → `failed`.
