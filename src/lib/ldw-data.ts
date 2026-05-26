import fs from 'fs';
import path from 'path';

export type EurSummaryRow = {
  zeile: string;
  label: string;
  totalNettoAg: number;
  rowCount: number;
};

export type TransactionRow = {
  id: string;
  date: string;
  payee: string;
  direction: 'in' | 'out';
  amount: number;
  hat: string;
  suggestedAccount: string;
  skr03: string;
  eurZeile: string;
  eurLabel: string;
  confidence: string;
  bank: string;
  source: string;
  needsReview: boolean;
};

/** @deprecated Use TransactionRow — kept for gradual migration */
export type InboxRow = Pick<
  TransactionRow,
  'date' | 'payee' | 'amount' | 'hat' | 'suggestedAccount' | 'confidence' | 'bank' | 'source'
> & {
  skr03: string;
  eurZeile: string;
  eurLabel: string;
};

/** @deprecated Use TransactionRow */
export type LedgerRow = Pick<
  TransactionRow,
  | 'date'
  | 'payee'
  | 'amount'
  | 'hat'
  | 'suggestedAccount'
  | 'skr03'
  | 'eurZeile'
  | 'eurLabel'
  | 'bank'
  | 'direction'
>;

const DEFAULT_ROOT = 'C:\\DATA\\20_ADMIN';
const BUNDLED_DIR = path.join(process.cwd(), 'src', 'data', 'euer');

const ACCOUNT_ALIASES: Record<string, string> = {
  'Telephony/Internet': 'Telefax u Internetkosten',
  'Consumption, Meals, and Entertainment': 'Consumption Meals and Entertainment',
  'Consumption Meals and Entertainment': 'Consumption Meals and Entertainment',
};

const SKIP_HATS = new Set(['private', 'transfer']);
const DEFAULT_REVIEW_ZEILE = '66';

let cachedAccountMap: Map<string, string> | null = null;
let cachedEurLabels: Record<string, string> | null = null;
let cachedChartByName: Map<string, string> | null = null;

function dataRoot(): string {
  const env = process.env.LDW_DATA_ROOT;
  if (env && fs.existsSync(env)) return env;
  return DEFAULT_ROOT;
}

function zohoBooksDir(): string {
  return path.join(dataRoot(), '!!_ZOHO-BOOKS');
}

function taxYearDir(year: number): string {
  return path.join(dataRoot(), `!_TAXES-${year}`);
}

function parseSemicolonCsv(content: string): Record<string, string>[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(';').map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(';');
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = (parts[idx] ?? '').trim();
    });
    rows.push(row);
  }
  return rows;
}

function parseGermanAmount(raw: string): number {
  const value = (raw || '').trim();
  if (!value) return 0;
  let cleaned = value.replace(/€/g, '').replace(/\s/g, '');
  if (cleaned.includes('.') && cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.replace(',', '.');
  }
  return Math.abs(parseFloat(cleaned) || 0);
}

function parseCommaCsv(content: string): string[][] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  return lines.map((line) => {
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === ',' && !inQuotes) {
        parts.push(current.trim());
        current = '';
        continue;
      }
      current += ch;
    }
    parts.push(current.trim());
    return parts;
  });
}

function loadAccountEurMap(): Map<string, string> {
  if (cachedAccountMap) return cachedAccountMap;
  const paths = [
    path.join(zohoBooksDir(), 'zoho-account-eur-map.csv'),
    path.join(BUNDLED_DIR, 'account-eur-map.csv'),
  ];
  const map = new Map<string, string>();
  for (const filePath of paths) {
    if (!fs.existsSync(filePath)) continue;
    const rows = parseCommaCsv(fs.readFileSync(filePath, 'utf-8'));
    for (let i = 1; i < rows.length; i++) {
      const [name, zeile] = rows[i];
      if (!name?.trim()) continue;
      const z = (zeile ?? '').trim();
      if (z) map.set(name.trim(), z);
    }
    break;
  }
  cachedAccountMap = map;
  return map;
}

function loadEurLabels(): Record<string, string> {
  if (cachedEurLabels) return cachedEurLabels;
  const bundled = path.join(BUNDLED_DIR, 'eur-zeile-labels.json');
  if (fs.existsSync(bundled)) {
    cachedEurLabels = JSON.parse(fs.readFileSync(bundled, 'utf-8')) as Record<string, string>;
    return cachedEurLabels;
  }
  cachedEurLabels = {};
  return cachedEurLabels;
}

function loadChartByAccountName(): Map<string, string> {
  if (cachedChartByName) return cachedChartByName;
  const chartPath = path.join(zohoBooksDir(), 'Chart_of_Accounts.csv');
  const map = new Map<string, string>();
  if (fs.existsSync(chartPath)) {
    const rows = parseCommaCsv(fs.readFileSync(chartPath, 'utf-8'));
    const headers = rows[0] ?? [];
    const nameIdx = headers.findIndex((h) => h === 'Account Name');
    const codeIdx = headers.findIndex((h) => h === 'Account Code');
    if (nameIdx >= 0 && codeIdx >= 0) {
      for (let i = 1; i < rows.length; i++) {
        const name = rows[i][nameIdx]?.trim();
        const code = rows[i][codeIdx]?.trim();
        if (name && code) map.set(name, code);
      }
    }
  }
  cachedChartByName = map;
  return map;
}

function resolveAccountName(raw: string): string {
  const trimmed = raw.trim();
  return ACCOUNT_ALIASES[trimmed] ?? trimmed;
}

function resolveEurZeile(accountName: string, hat: string): string {
  if (hat === 'income') {
    const map = loadAccountEurMap();
    const z = map.get(resolveAccountName(accountName));
    if (z) return z;
    return '11';
  }
  const map = loadAccountEurMap();
  const resolved = resolveAccountName(accountName);
  const z = map.get(resolved);
  if (z) return z;
  if (hat === 'review' || hat === 'liability_split' || hat === 'business') return DEFAULT_REVIEW_ZEILE;
  return '';
}

function resolveSkr03(row: Record<string, string>, accountName: string): string {
  const fromRow = (row['SKR Code'] || '').trim();
  if (fromRow) return fromRow;
  const chart = loadChartByAccountName();
  return chart.get(resolveAccountName(accountName)) ?? chart.get(accountName) ?? '';
}

function eurLabelForZeile(zeile: string): string {
  if (!zeile) return '';
  const labels = loadEurLabels();
  const full = labels[zeile];
  if (full) return full;
  const prefix = zeile.length >= 2 ? zeile.slice(0, 2) : zeile;
  return labels[prefix] ?? '';
}

function transactionNeedsReview(row: TransactionRow): boolean {
  const fromWorkbook = row.confidence === 'workbook';
  if (row.hat === 'review' || row.hat === 'liability_split') return true;
  if (!row.eurZeile) return true;
  if (!fromWorkbook && (!row.skr03 || !row.suggestedAccount)) return true;
  if (row.confidence === 'low') return true;
  if (row.eurZeile === DEFAULT_REVIEW_ZEILE && row.hat !== 'income') return true;
  return false;
}

function dedupeKey(
  date: string,
  withdrawals: number,
  deposits: number,
  payee: string,
  bank: string
): string {
  return `${date}|${withdrawals.toFixed(2)}|${deposits.toFixed(2)}|${payee.toLowerCase()}|${bank}`;
}

function bundledSummaryPath(year: number): string {
  return path.join(BUNDLED_DIR, `euer-summary-${year}.csv`);
}

type WorkbookExportRow = {
  date: string;
  payee: string;
  direction: 'in' | 'out';
  amount: number;
  eurZeile: string;
  eurLabel: string;
};

function masterWorkbookPath(): string {
  return path.join(dataRoot(), '!!_TAX-ADMIN', '250111_LDW_EÜR-seit2020-m-Vorlage.xlsx');
}

function workbookTransactionsPaths(year: number): string[] {
  return [
    path.join(zohoBooksDir(), 'logs', 'zoho-working', `transactions-workbook-${year}.json`),
    path.join(BUNDLED_DIR, `transactions-workbook-${year}.json`),
  ];
}

function loadWorkbookTransactions(year: number): TransactionRow[] {
  const jsonPath = workbookTransactionsPaths(year).find((p) => fs.existsSync(p));
  if (!jsonPath) return [];

  const payload = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as {
    rows?: WorkbookExportRow[];
  };
  const source = path.basename(jsonPath);
  const rows: TransactionRow[] = [];

  for (const row of payload.rows ?? []) {
    if (!row.date?.includes(String(year))) continue;
    const withdrawals = row.direction === 'out' ? row.amount : 0;
    const deposits = row.direction === 'in' ? row.amount : 0;
    const hat = row.direction === 'in' ? 'income' : 'business';
    const account = '';
    const skr03 = resolveSkr03({}, account);
    const eurZeile = row.eurZeile || zeileFromLabel(row.eurLabel);
    const eurLabel = row.eurLabel || eurLabelForZeile(eurZeile);

    const tx: TransactionRow = {
      id: dedupeKey(row.date, withdrawals, deposits, row.payee, 'EÜR workbook'),
      date: row.date,
      payee: row.payee,
      direction: row.direction,
      amount: row.amount,
      hat,
      suggestedAccount: account,
      skr03,
      eurZeile,
      eurLabel,
      confidence: 'workbook',
      bank: 'EÜR workbook',
      source,
      needsReview: false,
    };
    tx.needsReview = transactionNeedsReview(tx);
    rows.push(tx);
  }

  return rows;
}

function zeileFromLabel(label: string): string {
  const text = (label || '').trim();
  if (!text) return '';
  const head = text.includes(' - ') ? text.split(' - ')[0].trim() : text;
  const m = head.match(/^(\d{1,3})/);
  return m ? m[1] : '';
}

type ZohoExportRow = {
  date: string;
  payee: string;
  direction: 'in' | 'out';
  amount: number;
  hat: string;
  suggestedAccount: string;
  skr03: string;
  bank: string;
  source: string;
};

function zohoTransactionsPaths(year: number): string[] {
  return [
    path.join(zohoBooksDir(), 'logs', 'zoho-working', `transactions-zoho-${year}.json`),
    path.join(BUNDLED_DIR, `transactions-zoho-${year}.json`),
  ];
}

function loadZohoExportTransactions(year: number): TransactionRow[] {
  const jsonPath = zohoTransactionsPaths(year).find((p) => fs.existsSync(p));
  if (!jsonPath) return [];

  const payload = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as { rows?: ZohoExportRow[] };
  const fileSource = path.basename(jsonPath);
  const rows: TransactionRow[] = [];

  for (const row of payload.rows ?? []) {
    if (SKIP_HATS.has(row.hat)) continue;
    const withdrawals = row.direction === 'out' ? row.amount : 0;
    const deposits = row.direction === 'in' ? row.amount : 0;
    const account = row.suggestedAccount || '';
    const skr03 = row.skr03 || resolveSkr03({}, account);
    const eurZeile = resolveEurZeile(account, row.hat);
    const eurLabel = eurLabelForZeile(eurZeile);

    const tx: TransactionRow = {
      id: dedupeKey(row.date, withdrawals, deposits, row.payee, row.bank),
      date: row.date,
      payee: row.payee,
      direction: row.direction,
      amount: row.amount,
      hat: row.hat,
      suggestedAccount: account,
      skr03,
      eurZeile,
      eurLabel,
      confidence: 'zoho-export',
      bank: row.bank,
      source: row.source || fileSource,
      needsReview: false,
    };
    tx.needsReview = transactionNeedsReview(tx);
    rows.push(tx);
  }

  return rows;
}

function loadSuggestionFiles(year: number): string[] {
  const fromDisk: string[] = [];
  const dir = taxYearDir(year);
  if (fs.existsSync(dir)) {
    fromDisk.push(
      ...fs
        .readdirSync(dir)
        .filter((name) => name.endsWith('-booking-suggestions.csv'))
        .map((name) => path.join(dir, name))
    );
  }
  if (fromDisk.length > 0) return fromDisk;

  if (fs.existsSync(BUNDLED_DIR)) {
    const bundled = fs
      .readdirSync(BUNDLED_DIR)
      .filter((name) => name.startsWith(`suggestions-${year}-`) && name.endsWith('.csv'))
      .map((name) => path.join(BUNDLED_DIR, name));
    if (bundled.length > 0) return bundled;
    const legacy = path.join(BUNDLED_DIR, `inbox-ledger-${year}.csv`);
    if (fs.existsSync(legacy)) return [legacy];
    const fallback = path.join(BUNDLED_DIR, 'inbox-ledger-2024.csv');
    return fs.existsSync(fallback) ? [fallback] : [];
  }
  return [];
}

function mapSuggestionToTransaction(
  row: Record<string, string>,
  bank: string,
  source: string,
  withdrawals: number,
  deposits: number
): TransactionRow | null {
  const hat = (row.Hat || '').toLowerCase();
  if (SKIP_HATS.has(hat)) return null;
  if (withdrawals <= 0 && deposits <= 0) return null;

  const payee = row.Payee || row.Description || '';
  const account = row['Suggested Account'] || '';
  const direction: 'in' | 'out' = deposits > 0 && withdrawals <= 0 ? 'in' : 'out';
  const amount = withdrawals || deposits;
  const skr03 = resolveSkr03(row, account);
  const eurZeile = resolveEurZeile(account, hat);
  const eurLabel = eurLabelForZeile(eurZeile);
  const bankName = row['Source Bank Account'] || bank;

  const tx: TransactionRow = {
    id: dedupeKey(row.Date, withdrawals, deposits, payee, bankName),
    date: row.Date,
    payee,
    direction,
    amount,
    hat,
    suggestedAccount: account,
    skr03,
    eurZeile,
    eurLabel,
    confidence: row.Confidence || '',
    bank: bankName,
    source,
    needsReview: false,
  };
  tx.needsReview = transactionNeedsReview(tx);
  return tx;
}

export function getAvailableYears(): number[] {
  const years = new Set<number>();
  if (fs.existsSync(BUNDLED_DIR)) {
    for (const name of fs.readdirSync(BUNDLED_DIR)) {
      const m1 = name.match(/^euer-summary-(\d{4})\.csv$/);
      const m2 = name.match(/^suggestions-(\d{4})-/);
      const m3 = name.match(/^transactions-workbook-(\d{4})\.json$/);
      const m4 = name.match(/^transactions-zoho-(\d{4})\.json$/);
      if (m1) years.add(Number(m1[1]));
      if (m2) years.add(Number(m2[1]));
      if (m3) years.add(Number(m3[1]));
      if (m4) years.add(Number(m4[1]));
    }
  }
  const root = dataRoot();
  if (fs.existsSync(root)) {
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      const match = entry.name.match(/^!_TAXES-(\d{4})$/);
      if (match) years.add(Number(match[1]));
    }
  }
  if (years.size === 0) return [2024, 2023, 2022, 2021, 2020];
  return [...years].sort((a, b) => b - a);
}

export function getEurSummary(year: number): EurSummaryRow[] {
  const paths = [
    path.join(zohoBooksDir(), 'logs', 'zoho-working', `euer-summary-${year}.csv`),
    bundledSummaryPath(year),
  ];
  const summaryPath = paths.find((p) => fs.existsSync(p));
  if (!summaryPath) return [];

  const content = fs.readFileSync(summaryPath, 'utf-8');
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const rows: EurSummaryRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length < 4) continue;
    rows.push({
      zeile: parts[0],
      label: parts[1]?.replace(/^"|"$/g, '') ?? '',
      totalNettoAg: parseFloat(parts[2]) || 0,
      rowCount: parseInt(parts[3], 10) || 0,
    });
  }
  return rows.sort((a, b) => parseInt(a.zeile, 10) - parseInt(b.zeile, 10));
}

export function getTransactionRows(year: number): TransactionRow[] {
  const seen = new Set<string>();
  const rows: TransactionRow[] = [];

  const addRow = (tx: TransactionRow | null) => {
    if (!tx || seen.has(tx.id)) return;
    seen.add(tx.id);
    rows.push(tx);
  };

  for (const filePath of loadSuggestionFiles(year)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = parseSemicolonCsv(content);
    const source = path.basename(filePath);
    const bank = source
      .replace('-booking-suggestions.csv', '')
      .replace(/^suggestions-\d{4}-/, '')
      .replace(/^inbox-ledger-/, '');

    for (const row of parsed) {
      if (!row.Date?.includes(String(year))) continue;
      const withdrawals = parseGermanAmount(row.Withdrawals || '0');
      const deposits = parseGermanAmount(row.Deposits || '0');
      addRow(mapSuggestionToTransaction(row, bank, source, withdrawals, deposits));
    }
  }

  for (const tx of loadZohoExportTransactions(year)) {
    addRow(tx);
  }

  for (const tx of loadWorkbookTransactions(year)) {
    addRow(tx);
  }

  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export function getInboxRows(year: number): InboxRow[] {
  return getTransactionRows(year)
    .filter((row) => row.needsReview)
    .map((row) => ({
      date: row.date,
      payee: row.payee,
      amount: row.amount,
      hat: row.hat,
      suggestedAccount: row.suggestedAccount,
      confidence: row.confidence,
      bank: row.bank,
      source: row.source,
      skr03: row.skr03,
      eurZeile: row.eurZeile,
      eurLabel: row.eurLabel,
    }));
}

export function getLedgerRows(year: number): LedgerRow[] {
  return getTransactionRows(year).map((row) => ({
    date: row.date,
    payee: row.payee,
    amount: row.amount,
    hat: row.hat,
    suggestedAccount: row.suggestedAccount,
    skr03: row.skr03,
    eurZeile: row.eurZeile,
    eurLabel: row.eurLabel,
    bank: row.bank,
    direction: row.direction,
  }));
}

export function getPaths() {
  const root = dataRoot();
  const onVercel = Boolean(process.env.VERCEL);
  return {
    dataRoot: root,
    dataSource: onVercel || !fs.existsSync(root) ? 'bundled' : 'local',
    masterWorkbook: masterWorkbookPath(),
    zohoBooks: zohoBooksDir(),
    accountMap: path.join(zohoBooksDir(), 'zoho-account-eur-map.csv'),
    chartOfAccounts: path.join(zohoBooksDir(), 'Chart_of_Accounts.csv'),
  };
}
