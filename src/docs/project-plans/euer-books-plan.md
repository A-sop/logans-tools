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
- `inbox-ledger-2024.csv` (sample inbox/ledger for 2024 on serverless)

Local dev with full `C:\DATA\20_ADMIN`: set `LDW_DATA_ROOT` in `.env.local`.

## Scripts (PC)

```powershell
cd C:\DATA\20_ADMIN\!!_ZOHO-BOOKS
.\run_ldw_booking_year.ps1 -Year 2024
python scripts/euer_fill_from_suggestions.py --year 2024
python scripts/euer_workbook.py summarize --year 2024
```

Copy updated `euer-summary-*.csv` into `logans-tools/src/data/euer/` before push when totals change.
