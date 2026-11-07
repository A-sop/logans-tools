# Acceptance: ln02 wake-if-new gate for cron Grok routines (RR-010 item 3)

Recorded before any code. Ordered by Logan on Sun 1 Nov 2026 ~18:51 Berlin via LDW
Communicator ("make it happen now" / "set that up now") for RR-010 items 3 and 4. Built by Div4.
Ships BEFORE the full watchman (logans-tools #62) and must not depend on it. Gate: Dept13 PASS
before anything goes live on ln02. Merge and install need Logan's yes. No DB writes, no messages
to anyone, no install on ln02 in the build session.

## Purpose

Grok Bot routines that today fire on a cron and wake an agent even when there is nothing to do
become webhook-triggered. A tiny ln02 script runs on the old schedule, checks "anything new since
last successful wake?", and only then POSTs the agent routine's webhook. Else it exits silently.

## Jobs (AC1)

| Job | Schedule (Europe/Berlin) | Wake when |
|---|---|---|
| `telegram_triage` | 4×/day | New Telegram captures since last cursor |
| `mail_triage` | 3×/day | New mail needing triage since last cursor |
| `status_div1` … `status_div7` | 12:30 and 20:45 | Something changed for that division since last report |
| `morning_brief` | once morning | Anything new overnight (captures + mail + same change signals) |

Exact Grok panel cron times for telegram/mail/morning were not found in DABOS docs or role hats
at build time; timers use documented placeholders listed in the runbook and must be confirmed
against each Grok routine panel before cutover. Status 12:30 / 20:45 match the prompt and the
status-digest read times.

## Data sources found (read-only research; AC2)

1. **Telegram captures:** Neon `tasks` with `ingest_source = 'telegram'` (dual-write from capture
   bot via `/api/dabos/ingest`). Live capture host is HZR52 per
   `DABOS/docs/reference/dept21-executive-director/founder-desk/dabos-telegram-capture.md`; Neon
   is the shared SSOT the triage agent already uses. Check: count / max `created_at` after cursor.
2. **Mail triage:** Migadu IMAP `mail@loganwilliams.com`, read today by
   `DABOS/scripts/dept01-intake/mail/triage_mail_imap.py` (env `MAIL_TRIAGE_IMAP_*`). Not a Neon
   table. Check from ln02: IMAP UID search after cursor; never fetch bodies.
3. **Division status change:** GitHub events/PRs on `A-sop/logans-tools` and `A-sop/DABOS`
   (read-only token) plus Neon read-only SELECT on `role_runs`, `stats`, `approval_queue` for that
   division (same family of sources as status-digest #61). Env names only.
4. **Morning brief:** OR of (1)–(3) overnight since last successful wake cursor.

Where a source cannot be reached at runtime, fail closed (error path), never silent forever-skip.

## Runner (AC3)

- Path: `ops/ln02/wake-if-new/` — generic runner + one check module per job family.
- Per-job state file: cursor + last-wake timestamp + consecutive error count.
- Lockfile per job. JSON log lines with no message bodies, URLs, tokens or secrets.
- Config: `~/.config/dabos/wake-if-new.env` (mode 600) holds env **names** filled by Logan:
  `WAKE_<JOB>_URL`, `WAKE_<JOB>_KEY`, plus data-source URLs/tokens. Webhook auth default
  `Authorization: Bearer <key>`; header name and scheme configurable.
- Fail closed: after 2 consecutive check errors, wake once with reason `check-error` (no body).
- Counting CSV: one line per run (`job,ts,decision`) with `wake|skip|error` for before/after counts.
- Installer: plan by default, `--apply`, `--undo --apply`, same style as
  `ops/ln02/install-ln02-checkout-sync.sh`. systemd user timers, `Persistent=true`.

## Tests and docs (AC4)

- Vitest (bash) covers runner: skip, wake, error escalation to `check-error` wake; each check:
  skip vs wake vs error.
- Runbook lists, per job, which Grok routine to change from cron → webhook, and env names to fill.
- Full suite green on the PR head.

## Out of scope

- Applying install on ln02, filling secrets, changing Grok panels (Logan / LDW after Dept13 PASS).
- Watchman (#62), status-digest delivery, any Neon DDL.
