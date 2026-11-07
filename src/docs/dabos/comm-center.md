# Comm center — three baskets (IN / PENDING / OUT)

Dept2 spec v3 (1 Nov 2026). Acceptance:
`docs/acceptance/2026-11-01_comm-center-baskets-v3.ACCEPTANCE.md`.

**Owner post:** Dept12 Production (Div4) for install/SQL apply failures; Dept2 Coordination
for stalls and misroutes on the lines.

Nothing in this PR is applied to Neon or installed on ln02 until Dept13 PASS and Logan's yes.

## Apply order (after PASS + yes)

1. **Rollback CSV** (read-only):  
   `npm run dabos:comm-center-rollback-export -- --out ~/comm-center-rollback.csv`  
   Keep the printed sha256 with the CSV.
2. **Normalisation:**  
   `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f scripts/dabos/sql/2026-11-01_comm_center_normalise_addressees.sql`
3. **Re-basketing:**  
   `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f scripts/dabos/sql/2026-11-01_comm_center_rebasket.sql`
4. **View (+ optional grants):**  
   `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f scripts/dabos/sql/2026-11-01_v_comm_station.sql`
5. **Optional P6 index (later):**  
   `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f scripts/dabos/sql/2026-11-01_comm_center_pending_index.sql`
6. **ln02 install:**  
   `bash ops/ln02/install-comm-center.sh` (plan) then `--apply`.

UNDO files sit next to each SQL file. Data UNDOs restore from the rollback CSV (no blind reverse map).

## Env names Logan fills

File: `~/.config/dabos/comm-center.env` (mode **600**). Template:
`ops/ln02/comm-center/env.example` + clocks from `ops/ln02/comm-center/clocks.env.example`.

| Name | Purpose |
|---|---|
| `COMM_CENTER_DATABASE_URL` | Neon URL for courier/wake SELECTs/UPDATEs |
| `COMM_TZ` | `Europe/Berlin` |
| `COMM_CLOCK_*` | Pick-up clocks (not hardcoded in scripts) |
| `WAKE_DIV1_URL` / `WAKE_DIV1_KEY` … `WAKE_DIV7_*`, `WAKE_LDW_*` | Grok webhook per post |
| `WAKE_KEY_HEADER` / `WAKE_KEY_SCHEME` | Default `Authorization` / `Bearer` (same as wake-if-new) |

Logan places values himself. Installer never creates or prints the env file.

## Grok routines → webhook (one per post)

Convert each post's pick-up / status routine from cron to **webhook trigger**. Env stem = post upper-case:

| Post | Env | Routine to convert (create webhook if missing) |
|---|---|---|
| Div1 | `WAKE_DIV1_*` | Div1 intake / pick-up |
| Div2 | `WAKE_DIV2_*` | Div2 pick-up |
| Div3 | `WAKE_DIV3_*` | Div3 pick-up (leave 10th/25th + books jobs as they are) |
| Div4 | `WAKE_DIV4_*` | Div4 pick-up / builder |
| Div5 | `WAKE_DIV5_*` | Div5 pick-up / review |
| Div6 | `WAKE_DIV6_*` | Div6 pick-up |
| Div7 | `WAKE_DIV7_*` | Div7 pick-up (+ Thu EC uses same webhook at 21:05) |
| LDW | `WAKE_LDW_*` | LDW morning brief + digest read |

Webhook body (only): `{post, in_count, pending_count, oldest_in_age, reason}`.

**Untouched:** fixed Thu 14:00 / 14:30 stat scripts; Div3's existing calendar jobs.

## Pick-up clocks (Europe/Berlin)

Courier runs **1 minute before** each slot. Clocks live in config (`COMM_CLOCK_*`), defaults in
`clocks.env.example`:

- Div1 08:00, 13:00, 18:00 daily + Thu 14:45
- LDW 08:15, 20:50 daily
- Div2, Div3, Div6 09:15, 15:30 daily
- Div4 09:00, 13:30, 17:30 Mon–Fri; 09:00, 17:30 Sat–Sun
- Div5 10:30, 15:00, 19:00 Mon–Fri; 10:30, 19:00 Sat–Sun
- Div7 08:30, 16:30 daily + Thu 21:05
- Digest build marker 20:45 (no agent wake)

## On every wake (agents)

```bash
npm run dabos:hat-receipt -- --dept DeptN --task <uuid> --summary "<what you did>"
```

PENDING review (P5): call `stampPendingReviewed(sql, taskId)` (or equivalent) so
`ingest_meta.pending.last_reviewed` moves. The script writes `last_checked` every slot.

Writers: use `preparePendingIngestMeta` / `moveTaskToPending` — never set `basket='pending'`
without `reason` and `waiting_on` (P1).

## Digest (20:45)

Additive section module: `src/lib/dabos/comm-center/digest-section.ts`
(`buildCommCenterDigestSection`). When #61 status-digest lands, append this section; do **not**
ship a second digest. It covers `v_comm_station` counts/ages, pending `approval_queue`, Dept13
lines, and posts that woke without a hat receipt.

## Install commands

```bash
bash ops/ln02/install-comm-center.sh                 # plan
bash ops/ln02/install-comm-center.sh --apply         # install
bash ops/ln02/install-comm-center.sh --undo --apply  # remove (keeps env + state)
```
