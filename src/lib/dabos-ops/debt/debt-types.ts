export type DebtStrategy = 'snowball' | 'avalanche' | 'custom';

export interface DebtPaths {
  root: string;
  dbPath: string;
  seedDir: string;
}

export interface DebtRecord {
  id: number;
  creditor: string;
  category: string | null;
  startDebt: number;
  currentBalance: number;
  apr: number; // annual rate as decimal, e.g. 0.06
  minPayment: number;
  payoffOrder: number | null;
  inCollections: boolean;
  note: string | null;
  updatedAt: string;
}

export interface BillRecord {
  id: number;
  dueDate: string | null;
  payee: string;
  amount: number;
  note: string | null;
  reference: string | null;
  priority: number | null;
  status: string;
  updatedAt: string;
}

export interface PlannedPurchaseRecord {
  id: number;
  item: string;
  payee: string | null;
  estCost: number;
  note: string | null;
  status: string;
}

export interface DebtSettings {
  monthlyIncome: number;
  monthlyBudget: number;
  strategy: DebtStrategy;
  currency: string;
}

export interface PayoffStep {
  order: number;
  creditor: string;
  balance: number;
  apr: number;
  minPayment: number;
}

export interface DebtSummary {
  asOf: string;
  settings: DebtSettings;
  totalDebt: number;
  totalMinPayments: number;
  billsTotal: number;
  plannedTotal: number;
  debtToIncomePct: number;
  feasible: boolean; // budget covers minimum payments
  months: number | null;
  totalInterest: number | null;
  freeDate: string | null; // YYYY-MM
  order: PayoffStep[];
  balanceTimeline: number[]; // total balance per month
}
