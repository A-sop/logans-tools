# Debt tracker (Atlas module)

Ported from the CSV+Python tracker in `C:\DATA\20_ADMIN\!_FINANCE-TRACKER\debt`.
Same numbers, now in Atlas: SQLite store, a `/debt` dashboard, and CLI scripts.

## Files
- `debt-config.ts` â€” paths + default settings. DB lives **outside the repo** at
  `C:\DATA\10_WORK\Atlas-Debt\atlas-debt.db` (override with `DABOS_DEBT_DB_PATH`).
- `debt-types.ts` â€” shared types.
- `debt-index.ts` â€” `better-sqlite3` store (debts, bills, planned_purchases, settings, balance_history).
- `debt-calc.ts` â€” pure payoff math (snowball / avalanche / custom + DtI). Faithful port of
  `debt_report.py`; verified to match to the cent (â‚¬55,832 Â· DtI 59% Â· 66 months @ â‚¬1,000/mo).

## Use
```bash
npm run debt:init      # create the DB + default settings
npm run debt:import    # seed debts/bills/planned from the CSV tracker (+ history snapshot)
npm run debt:report    # print a console summary
npm run dev            # then open http://localhost:3000/debt
```

## Editing the numbers
For now the **CSVs in `!_FINANCE-TRACKER\debt` remain the editable source**: edit a balance there,
run `npm run debt:import`, and the DB + dashboard update (each import also writes a
`balance_history` snapshot so totals can be trended over time).

Settings (income, monthly budget, strategy) live in the `settings` table â€” change the strategy with
e.g. a quick `debt:report` after updating, or set `strategy` to `snowball | avalanche | custom`.

## Next (v2 ideas)
- Inline edit UI on `/debt` (write back to SQLite) so the CSVs aren't needed.
- Balance-over-time chart from `balance_history`.
- Pull live balances where an API exists (KfW, banks) instead of manual entry.
