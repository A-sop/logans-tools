# LDW Books (EÜR) — Project Plan

**Preview domain:** `euer.logans.tools`
**Repo:** `logans-tools` (same Vercel project as `gabc.logans.tools`)
**Routes:** `/euer`, `/euer/inbox`, `/euer/ledger`, `/euer/tax`
**Access:** email gate — `inbox@loganwilliams.com` or any `@loganwilliams.com` (cookie `euer_preview`, 30 days)

## Deploy checklist

1. **Push** `main` → Vercel auto-deploy (`logans-tools` project).
2. **Vercel** → Project → Settings → Domains → Add `euer.logans.tools`.
3. **DNS** (authoritative NS for `logans.tools`):
   - `CNAME` `euer` → `cname.vercel-dns.com.` (or the target Vercel shows for this project).
   - If a wildcard `*` points to Vercel, add an explicit `euer` record anyway.
4. Open https://euer.logans.tools → enter `inbox@loganwilliams.com`.

## Data on Vercel

Bundled under `src/data/euer/`:

- `euer-summary-2020.csv` … `euer-summary-2024.csv`
- `suggestions-YYYY-*.csv` — booking-suggestions per bank (merged + deduped in UI)
- `transactions-workbook-YYYY.json` — lines from master `YYYY_EÜR` sheet (2020–2026)
- `account-eur-map.csv`, `eur-zeile-labels.json` — EÜR Zeile + labels (no API)
- `euer-summary-2025.csv`, `euer-summary-2026.csv` — Tax tab totals

Refresh bundle from PC:

```powershell
cd C:\Dev\logans-tools
.\scripts\sync-bundled-euer-data.ps1
git add src/data/euer && git commit -m "chore(euer): refresh bundled tax data" && git push
vercel deploy --prod
```

Local dev with full `C:\DATA\20_ADMIN`: set `LDW_DATA_ROOT` in `.env.local`.

**Transactions UI:** `/euer/ledger` — In/Out, SKR03, EÜR Zeile; excludes `transfer` / `private`. Inbox = lines needing review.

## Scripts (PC)

```powershell
cd C:\DATA\20_ADMIN\!!_ZOHO-BOOKS
.\run_ldw_booking_year.ps1 -Year 2024
python scripts/euer_fill_from_suggestions.py --year 2024
python scripts/euer_workbook.py summarize --year 2024
```

Copy updated `euer-summary-*.csv` into `logans-tools/src/data/euer/` before push when totals change.
