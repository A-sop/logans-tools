# wake-if-new (ln02) — RR-010 item 3

Tiny gate on ln02: on the old Grok cron schedule it checks whether there is new work, and only
then POSTs the routine's **webhook**. No work → silent exit. Ships before watchman (#62) and does
not depend on it. Install only after Dept13 PASS + Logan's merge yes.

## Cutover (LDW / Logan)

For each job below: open the named Grok Bot routine → change trigger from **cron** to **webhook** →
copy URL + sender key into `~/.config/dabos/wake-if-new.env` (mode 600) under the listed names →
disable the old cron on the routine. Confirm timer `OnCalendar` matches the old cron (placeholders
noted where docs had no exact time).

| Job | Grok routine to switch | Timer (Europe/Berlin) | Webhook env | Data-source env |
|---|---|---|---|---|
| `telegram_triage` | Div1 Telegram capture triage (4×/day) | 08:00, 12:00, 16:00, 20:00 *(placeholder — confirm panel)* | `WAKE_TELEGRAM_TRIAGE_URL` `WAKE_TELEGRAM_TRIAGE_KEY` | `WAKE_TELEGRAM_TRIAGE_DATABASE_URL` (Neon read-only; `tasks` where `ingest_source='telegram'`) |
| `mail_triage` | Div1 mail triage (3×/day) | 09:00, 13:00, 17:00 *(placeholder — confirm panel)* | `WAKE_MAIL_TRIAGE_URL` `WAKE_MAIL_TRIAGE_KEY` | `WAKE_MAIL_IMAP_HOST` `WAKE_MAIL_IMAP_PORT` `WAKE_MAIL_IMAP_FOLDER` `WAKE_MAIL_IMAP_USER` `WAKE_MAIL_IMAP_PASSWORD` (Migadu `mail@loganwilliams.com`, same as `MAIL_TRIAGE_IMAP_*`) |
| `status_div1` … `status_div7` | Per-division status report @ 12:30 and 20:45 | 12:30, 20:45 | `WAKE_STATUS_DIVN_URL` `WAKE_STATUS_DIVN_KEY` | `WAKE_STATUS_DATABASE_URL` (Neon read-only) + `WAKE_GITHUB_TOKEN` (read PRs on `A-sop/logans-tools`, `A-sop/DABOS`) |
| `morning_brief` | LDW morning brief | 07:00 *(placeholder — confirm panel)* | `WAKE_MORNING_BRIEF_URL` `WAKE_MORNING_BRIEF_KEY` | Uses telegram + mail + status sources above |

Auth header default: `Authorization: Bearer <key>`. Override with `WAKE_KEY_HEADER` /
`WAKE_KEY_SCHEME` (empty scheme = raw key as header value).

Shared optional fallback: `WAKE_DATABASE_URL`.

## Install (ln02)

```bash
bash ops/ln02/install-wake-if-new.sh                 # plan
bash ops/ln02/install-wake-if-new.sh --apply         # after Dept13 PASS + Logan yes
bash ops/ln02/install-wake-if-new.sh --undo --apply
WAKE_DRY_RUN=1 ~/bin/dabos-wake-if-new telegram_triage
```

State / counts: `~/.local/state/dabos/wake-if-new/` (`*.state.json`, `wake-if-new.jsonl`,
`counts.csv` with `job,ts,decision` ∈ wake|skip|error).

## Fail closed

A check error increments `consecutive_errors`. After **2** consecutive errors the runner wakes
once with reason `check-error` (empty body beyond job/reason) so work is not silently lost.

## Owner

Dept12 Production (Div4). Logs never contain message bodies, mail subjects, tokens or webhook URLs.
