import type {
  BillRecord,
  DebtRecord,
  DebtSettings,
  DebtSummary,
  PayoffStep,
  PlannedPurchaseRecord,
} from '@/lib/dabos-ops/debt/debt-types';

/**
 * Pure debt math â€” no database, no I/O. Faithful port of debt_report.py so the
 * Atlas tracker produces identical numbers to the original CSV tracker.
 */

function orderDebts(active: DebtRecord[], strategy: DebtSettings['strategy']): DebtRecord[] {
  const copy = [...active];
  if (strategy === 'avalanche') {
    copy.sort((a, b) => b.apr - a.apr || a.currentBalance - b.currentBalance);
  } else if (strategy === 'custom') {
    const key = (d: DebtRecord) => (d.payoffOrder && d.payoffOrder > 0 ? d.payoffOrder : 999);
    copy.sort((a, b) => key(a) - key(b));
  } else {
    copy.sort((a, b) => a.currentBalance - b.currentBalance); // snowball
  }
  return copy;
}

function simulate(
  ordered: DebtRecord[],
  monthlyBudget: number,
): { months: number; totalInterest: number; timeline: number[] } {
  const bals = new Map<string, number>();
  const aprs = new Map<string, number>();
  const mins = new Map<string, number>();
  const seq: string[] = [];
  for (const d of ordered) {
    bals.set(d.creditor, d.currentBalance);
    aprs.set(d.creditor, d.apr);
    mins.set(d.creditor, d.minPayment);
    seq.push(d.creditor);
  }

  let months = 0;
  let totalInterest = 0;
  const timeline: number[] = [];
  const sum = () => seq.reduce((acc, c) => acc + Math.max(bals.get(c) ?? 0, 0), 0);

  while (sum() > 0.01 && months < 600) {
    months += 1;
    // interest accrues
    for (const c of seq) {
      const b = bals.get(c) ?? 0;
      if (b > 0) {
        const i = (b * (aprs.get(c) ?? 0)) / 12;
        bals.set(c, b + i);
        totalInterest += i;
      }
    }
    let pool = monthlyBudget;
    // minimums first
    for (const c of seq) {
      const b = bals.get(c) ?? 0;
      if (b > 0) {
        const pay = Math.min(mins.get(c) ?? 0, b, pool);
        bals.set(c, b - pay);
        pool -= pay;
      }
    }
    // remainder to the first unpaid target in order
    for (const c of seq) {
      if (pool <= 0) break;
      const b = bals.get(c) ?? 0;
      if (b > 0) {
        const pay = Math.min(b, pool);
        bals.set(c, b - pay);
        pool -= pay;
      }
    }
    timeline.push(Math.round(sum() * 100) / 100);
  }
  return { months, totalInterest: Math.round(totalInterest * 100) / 100, timeline };
}

function addMonths(asOf: string, months: number): string {
  const d = new Date(`${asOf}T00:00:00Z`);
  const total = d.getUTCMonth() + months;
  const year = d.getUTCFullYear() + Math.floor(total / 12);
  const month = (total % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function computeSummary(
  debts: DebtRecord[],
  settings: DebtSettings,
  bills: BillRecord[] = [],
  planned: PlannedPurchaseRecord[] = [],
  asOf: string = new Date().toISOString().slice(0, 10),
): DebtSummary {
  const active = debts.filter((d) => d.currentBalance > 0);
  const totalDebt = active.reduce((a, d) => a + d.currentBalance, 0);
  const totalMin = active.reduce((a, d) => a + d.minPayment, 0);
  const ordered = orderDebts(active, settings.strategy);

  const feasible = settings.monthlyBudget >= totalMin;
  const sim = feasible
    ? simulate(ordered, settings.monthlyBudget)
    : { months: null as number | null, totalInterest: null as number | null, timeline: [] as number[] };

  const dti = settings.monthlyIncome > 0 ? (totalMin / settings.monthlyIncome) * 100 : 0;
  const openBills = bills.filter((b) => b.status !== 'paid');

  const order: PayoffStep[] = ordered.map((d, i) => ({
    order: i + 1,
    creditor: d.creditor,
    balance: d.currentBalance,
    apr: d.apr,
    minPayment: d.minPayment,
  }));

  return {
    asOf,
    settings,
    totalDebt: Math.round(totalDebt * 100) / 100,
    totalMinPayments: Math.round(totalMin * 100) / 100,
    billsTotal: Math.round(openBills.reduce((a, b) => a + b.amount, 0) * 100) / 100,
    plannedTotal: Math.round(planned.reduce((a, p) => a + p.estCost, 0) * 100) / 100,
    debtToIncomePct: Math.round(dti * 10) / 10,
    feasible,
    months: sim.months,
    totalInterest: sim.totalInterest,
    freeDate: sim.months ? addMonths(asOf, sim.months) : null,
    order,
    balanceTimeline: sim.timeline,
  };
}
