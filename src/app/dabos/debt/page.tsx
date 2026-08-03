import type { ReactNode } from 'react';
import { existsSync } from 'node:fs';
import { getDebtPaths } from '@/lib/dabos-ops/debt/debt-config';
import { DebtIndex } from '@/lib/dabos-ops/debt/debt-index';
import { computeSummary } from '@/lib/dabos-ops/debt/debt-calc';
import type { BillRecord, DebtSummary } from '@/lib/dabos-ops/debt/debt-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Debt & Bills â€” DABOS',
  description: 'Personal Office debt snapshot (Office of LDW)',
};

function euro(n: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
}

function dtiColor(pct: number): string {
  if (pct >= 50) return '#e74c3c';
  if (pct >= 37) return '#e67e22';
  return '#2ecc71';
}

function load(): { summary: DebtSummary; bills: BillRecord[]; missing: boolean } | null {
  const paths = getDebtPaths();
  const missing = !existsSync(paths.dbPath);
  const index = new DebtIndex(paths.dbPath);
  try {
    const summary = computeSummary(
      index.listDebts(),
      index.getSettings(),
      index.listBills(),
      index.listPlanned()
    );
    return { summary, bills: index.listBills().filter((b) => b.status !== 'paid'), missing };
  } finally {
    index.close();
  }
}

export default function DabosDebtPage() {
  const data = load();
  if (!data) return <main className="p-8">Could not open the debt database.</main>;
  const { summary: s, bills } = data;
  const empty = s.order.length === 0;

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-800">
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">Debt &amp; Bills</h1>
        <p className="text-sm text-slate-500">
          Snapshot {s.asOf} Â· strategy: {s.settings.strategy} Â· source: debt DB (Office of LDW)
        </p>
      </header>

      {empty && (
        <div className="mb-5 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
          No debts loaded yet. Seed from the CSV tracker when ready.
        </div>
      )}

      <div className="mb-5 rounded-lg bg-slate-800 px-4 py-3 text-sm text-slate-100">
        {s.feasible ? (
          <>
            At {euro(s.settings.monthlyBudget)}/mo: debt-free in <b>~{s.months} months</b> (â‰ˆ {s.freeDate}) Â·
            interest â‰ˆ {euro(s.totalInterest ?? 0)}
          </>
        ) : (
          <span className="text-red-300">
            Budget {euro(s.settings.monthlyBudget)}/mo is below the {euro(s.totalMinPayments)}/mo minimum â€”
            increase the budget to project a payoff.
          </span>
        )}
      </div>

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Structured debt" value={euro(s.totalDebt)} />
        <Kpi label="Open bills" value={euro(s.billsTotal)} />
        <Kpi label="Min payments / mo" value={euro(s.totalMinPayments)} />
        <Kpi label="Debt-to-income" value={`${s.debtToIncomePct}%`} color={dtiColor(s.debtToIncomePct)} />
        <Kpi label="Wishlist (not owed)" value={euro(s.plannedTotal)} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={`Payoff order (${s.settings.strategy})`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-1 pr-2">#</th>
                <th className="py-1 pr-2">Creditor</th>
                <th className="py-1 pr-2 text-right">Balance</th>
                <th className="py-1 pr-2 text-right">APR</th>
                <th className="py-1 text-right">Min/mo</th>
              </tr>
            </thead>
            <tbody>
              {s.order.map((step) => (
                <tr key={step.creditor} className="border-t border-slate-100">
                  <td className="py-1 pr-2">{step.order}</td>
                  <td className="py-1 pr-2">{step.creditor}</td>
                  <td className="py-1 pr-2 text-right">{euro(step.balance)}</td>
                  <td className="py-1 pr-2 text-right">{(step.apr * 100).toFixed(1)}%</td>
                  <td className="py-1 text-right">{euro(step.minPayment)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 font-semibold">
                <td />
                <td className="py-1 pr-2">Total</td>
                <td className="py-1 pr-2 text-right">{euro(s.totalDebt)}</td>
                <td />
                <td className="py-1 text-right">{euro(s.totalMinPayments)}</td>
              </tr>
            </tbody>
          </table>
        </Card>

        <Card title={`Open bills (${bills.length})`}>
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-1 pr-2">Due</th>
                  <th className="py-1 pr-2">Payee</th>
                  <th className="py-1 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((b) => (
                  <tr key={b.id} className="border-t border-slate-100">
                    <td className="py-1 pr-2 whitespace-nowrap">{b.dueDate ?? 'â€”'}</td>
                    <td className="py-1 pr-2">{b.payee}</td>
                    <td className="py-1 text-right">{euro(b.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </main>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-bold" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      {children}
    </div>
  );
}
