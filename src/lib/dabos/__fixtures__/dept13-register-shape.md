<!-- Shape fixture: exact Verdict / Validated on / heading lines copied from A-sop/DABOS docs/registers/dept13-validation-checklists.md @ main 37aff075 (template lines 61-62; Instance 1-5 lines 68,82-83,87,101-102,107,119-120,124,136-137,142,156-157). Criteria bodies omitted. No client data. -->

Verdict: <empty until validation — PASS / FAIL + reasons (pointers to criteria failed)>
Validated on: <date> · Turnaround (pending → verdict): <duration, feeds validation_turnaround>

## Instance 1 — Gateway runtime-mix decision (ship-log row 1)
**Verdict: FAIL** — item 2 fails: the acceptance line's office-PC clause is not met under either the original or the amended wording (the amendment itself concedes this — "only partially met"). This is not producer rework in the ordinary sense; it is a founder-driven scope change (Logan wants to hands-on trial the tools before committing, and reserved the multi-Hermes-instance option) that supersedes the original acceptance line. Recommend: ship-log row 1 stays "pending"/not counted until the founder trial concludes and a real office-PC runtime decision is recorded; the trial-plan deliverable itself is sound and can be logged as its own (non-stat-feeding) artifact if desired.
**Validated on:** 2026-07-05 · **Turnaround:** submitted 2026-07-05 → validated 2026-07-05 (same day)

## Instance 2 — T1: Seed Neon with establishment + first stats
**Verdict: PASS** — Confirmed closed with Div5 sign-off 2026-10-13.
**Validated on:** 2026-07-05 · **Turnaround:** submitted 2026-07-05 → validated 2026-07-05 (same day)

## Instance 3 — T2: Feed the org board UI
**Verdict: PASS**
**Validated on:** 2026-07-11 · **Turnaround:** submitted 2026-07-05 → validated 2026-07-11 (founder walk + mechanical cross-check)

## Instance 4 — T3: Backup + headroom report script
**Verdict: PASS** (pending formal Dept13 hat re-sign-off on 2026-07-07 session — mechanical evidence supports PASS under rewritten acceptance line).
**Validated on:** 2026-07-07 · **Turnaround:** submitted 2026-07-05 → criterion amended 2026-07-07 → PASS

## Instance 5 — T4: PostHog onboarding
**Verdict: CONDITIONAL** (was PASS 2026-07-11; downgraded per PR #66 ship-log) — MCP retrieval on DABOS hub 221536; key migrated to local env + Vercel Production (both sites); `venture` register in instrumentation. **Note:** Build check was not re-run as part of this validation; redeploy to PostHog project 221536 key remains open as follow-up (GFP + loganwilliams-website production redeployments to use hub key). **Status 2026-10-21: CONDITIONAL** per the PR #66 ship-log (https://github.com/A-sop/DABOS/pull/66) - the 2026-10-13 sign-off does not count T4 until a live PostHog event in project 221536 plus an evidence link is recorded.
**Validated on:** 2026-07-11 · **Turnaround:** submitted 2026-07-05 → validated 2026-07-11 (credential + MCP retrieval unblocked)
