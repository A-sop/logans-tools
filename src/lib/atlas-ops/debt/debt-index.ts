import Database from 'better-sqlite3';
import { DEFAULT_SETTINGS } from '@/lib/atlas-ops/debt/debt-config';
import type {
  BillRecord,
  DebtRecord,
  DebtSettings,
  DebtStrategy,
  PlannedPurchaseRecord,
} from '@/lib/atlas-ops/debt/debt-types';

type DebtRow = {
  id: number;
  creditor: string;
  category: string | null;
  start_debt: number;
  current_balance: number;
  apr: number;
  min_payment: number;
  payoff_order: number | null;
  in_collections: number;
  note: string | null;
  updated_at: string;
};

type BillRow = {
  id: number;
  due_date: string | null;
  payee: string;
  amount: number;
  note: string | null;
  reference: string | null;
  priority: number | null;
  status: string;
  updated_at: string;
};

type PlannedRow = {
  id: number;
  item: string;
  payee: string | null;
  est_cost: number;
  note: string | null;
  status: string;
};

export class DebtIndex {
  private readonly db: Database.Database;

  public constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.ensureSchema();
  }

  public close(): void {
    this.db.close();
  }

  private ensureSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS debts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        creditor TEXT NOT NULL UNIQUE,
        category TEXT,
        start_debt REAL NOT NULL DEFAULT 0,
        current_balance REAL NOT NULL DEFAULT 0,
        apr REAL NOT NULL DEFAULT 0,
        min_payment REAL NOT NULL DEFAULT 0,
        payoff_order INTEGER,
        in_collections INTEGER NOT NULL DEFAULT 0,
        note TEXT,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS bills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        due_date TEXT,
        payee TEXT NOT NULL,
        amount REAL NOT NULL DEFAULT 0,
        note TEXT,
        reference TEXT,
        priority INTEGER,
        status TEXT NOT NULL DEFAULT 'open',
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS planned_purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item TEXT NOT NULL,
        payee TEXT,
        est_cost REAL NOT NULL DEFAULT 0,
        note TEXT,
        status TEXT NOT NULL DEFAULT 'wishlist'
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS balance_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot_at TEXT NOT NULL,
        total_debt REAL NOT NULL,
        total_min_payments REAL NOT NULL,
        bills_total REAL NOT NULL
      );
    `);
  }

  // ---- settings ----
  public getSettings(): DebtSettings {
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const map = new Map(rows.map((r) => [r.key, r.value]));
    return {
      monthlyIncome: Number(map.get('monthlyIncome') ?? DEFAULT_SETTINGS.monthlyIncome),
      monthlyBudget: Number(map.get('monthlyBudget') ?? DEFAULT_SETTINGS.monthlyBudget),
      strategy: (map.get('strategy') as DebtStrategy) ?? DEFAULT_SETTINGS.strategy,
      currency: map.get('currency') ?? DEFAULT_SETTINGS.currency,
    };
  }

  public setSetting(key: string, value: string | number): void {
    this.db
      .prepare(
        `INSERT INTO settings (key, value) VALUES (@key, @value)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .run({ key, value: String(value) });
  }

  public seedDefaultSettings(): void {
    const existing = this.db.prepare('SELECT COUNT(*) AS n FROM settings').get() as { n: number };
    if (existing.n > 0) return;
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) this.setSetting(k, v as string | number);
  }

  // ---- debts ----
  public replaceDebts(rows: Omit<DebtRecord, 'id' | 'updatedAt'>[]): void {
    const now = new Date().toISOString();
    const insert = this.db.prepare(`
      INSERT INTO debts (creditor, category, start_debt, current_balance, apr, min_payment,
                         payoff_order, in_collections, note, updated_at)
      VALUES (@creditor, @category, @startDebt, @currentBalance, @apr, @minPayment,
              @payoffOrder, @inCollections, @note, @updatedAt)
    `);
    const tx = this.db.transaction((items: typeof rows) => {
      this.db.prepare('DELETE FROM debts').run();
      for (const r of items) {
        insert.run({
          creditor: r.creditor,
          category: r.category ?? null,
          startDebt: r.startDebt,
          currentBalance: r.currentBalance,
          apr: r.apr,
          minPayment: r.minPayment,
          payoffOrder: r.payoffOrder ?? null,
          inCollections: r.inCollections ? 1 : 0,
          note: r.note ?? null,
          updatedAt: now,
        });
      }
    });
    tx(rows);
  }

  public listDebts(): DebtRecord[] {
    const rows = this.db.prepare('SELECT * FROM debts ORDER BY current_balance DESC').all() as DebtRow[];
    return rows.map((r) => ({
      id: r.id,
      creditor: r.creditor,
      category: r.category,
      startDebt: r.start_debt,
      currentBalance: r.current_balance,
      apr: r.apr,
      minPayment: r.min_payment,
      payoffOrder: r.payoff_order,
      inCollections: r.in_collections === 1,
      note: r.note,
      updatedAt: r.updated_at,
    }));
  }

  // ---- bills ----
  public replaceBills(rows: Omit<BillRecord, 'id' | 'updatedAt'>[]): void {
    const now = new Date().toISOString();
    const insert = this.db.prepare(`
      INSERT INTO bills (due_date, payee, amount, note, reference, priority, status, updated_at)
      VALUES (@dueDate, @payee, @amount, @note, @reference, @priority, @status, @updatedAt)
    `);
    const tx = this.db.transaction((items: typeof rows) => {
      this.db.prepare('DELETE FROM bills').run();
      for (const r of items) {
        insert.run({
          dueDate: r.dueDate ?? null,
          payee: r.payee,
          amount: r.amount,
          note: r.note ?? null,
          reference: r.reference ?? null,
          priority: r.priority ?? null,
          status: r.status ?? 'open',
          updatedAt: now,
        });
      }
    });
    tx(rows);
  }

  public listBills(): BillRecord[] {
    const rows = this.db.prepare('SELECT * FROM bills ORDER BY due_date').all() as BillRow[];
    return rows.map((r) => ({
      id: r.id,
      dueDate: r.due_date,
      payee: r.payee,
      amount: r.amount,
      note: r.note,
      reference: r.reference,
      priority: r.priority,
      status: r.status,
      updatedAt: r.updated_at,
    }));
  }

  // ---- planned purchases ----
  public replacePlanned(rows: Omit<PlannedPurchaseRecord, 'id'>[]): void {
    const insert = this.db.prepare(`
      INSERT INTO planned_purchases (item, payee, est_cost, note, status)
      VALUES (@item, @payee, @estCost, @note, @status)
    `);
    const tx = this.db.transaction((items: typeof rows) => {
      this.db.prepare('DELETE FROM planned_purchases').run();
      for (const r of items) {
        insert.run({
          item: r.item,
          payee: r.payee ?? null,
          estCost: r.estCost,
          note: r.note ?? null,
          status: r.status ?? 'wishlist',
        });
      }
    });
    tx(rows);
  }

  public listPlanned(): PlannedPurchaseRecord[] {
    const rows = this.db.prepare('SELECT * FROM planned_purchases ORDER BY est_cost DESC').all() as PlannedRow[];
    return rows.map((r) => ({
      id: r.id,
      item: r.item,
      payee: r.payee,
      estCost: r.est_cost,
      note: r.note,
      status: r.status,
    }));
  }

  // ---- history snapshot ----
  public snapshot(totalDebt: number, totalMin: number, billsTotal: number): void {
    this.db
      .prepare(
        `INSERT INTO balance_history (snapshot_at, total_debt, total_min_payments, bills_total)
         VALUES (@at, @td, @tm, @bt)`,
      )
      .run({ at: new Date().toISOString(), td: totalDebt, tm: totalMin, bt: billsTotal });
  }

  public listHistory(): { snapshotAt: string; totalDebt: number }[] {
    const rows = this.db
      .prepare('SELECT snapshot_at, total_debt FROM balance_history ORDER BY snapshot_at')
      .all() as { snapshot_at: string; total_debt: number }[];
    return rows.map((r) => ({ snapshotAt: r.snapshot_at, totalDebt: r.total_debt }));
  }
}
