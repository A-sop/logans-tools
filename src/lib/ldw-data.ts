import fs from 'fs';
import path from 'path';

export type EurSummaryRow = {
  zeile: string;
  label: string;
  totalNettoAg: number;
  rowCount: number;
};

export type InboxRow = {
  date: string;
  payee: string;
  amount: number;
  hat: string;
  suggestedAccount: string;
  confidence: string;
  bank: string;
  source: string;
};

export type LedgerRow = {
  date: string;
  payee: string;
  amount: number;
  hat: string;
  zeileHint: string;
  account: string;
  bank: string;
};

const DEFAULT_ROOT = 'C:\\DATA\\20_ADMIN';
const BUNDLED_DIR = path.join(process.cwd(), 'src', 'data', 'euer');

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

function bundledSummaryPath(year: number): string {
  return path.join(BUNDLED_DIR, `euer-summary-${year}.csv`);
}

function bundledSuggestionsPath(year: number): string | null {
  const specific = path.join(BUNDLED_DIR, `inbox-ledger-${year}.csv`);
  if (fs.existsSync(specific)) return specific;
  const fallback = path.join(BUNDLED_DIR, 'inbox-ledger-2024.csv');
  return fs.existsSync(fallback) ? fallback : null;
}

export function getAvailableYears(): number[] {
  const years = new Set<number>();
  if (fs.existsSync(BUNDLED_DIR)) {
    for (const name of fs.readdirSync(BUNDLED_DIR)) {
      const match = name.match(/^euer-summary-(\d{4})\.csv$/);
      if (match) years.add(Number(match[1]));
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

function loadSuggestionFiles(year: number): string[] {
  const dir = taxYearDir(year);
  const fromDisk: string[] = [];
  if (fs.existsSync(dir)) {
    fromDisk.push(
      ...fs
        .readdirSync(dir)
        .filter((name) => name.endsWith('-booking-suggestions.csv'))
        .map((name) => path.join(dir, name))
    );
  }
  if (fromDisk.length > 0) return fromDisk;

  const bundled = bundledSuggestionsPath(year);
  return bundled ? [bundled] : [];
}

function collectFromSuggestions<T>(
  year: number,
  filter: (hat: string) => boolean,
  mapRow: (
    row: Record<string, string>,
    bank: string,
    source: string,
    withdrawals: number,
    deposits: number
  ) => T | null
): T[] {
  const rows: T[] = [];
  for (const filePath of loadSuggestionFiles(year)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = parseSemicolonCsv(content);
    const source = path.basename(filePath);
    const bank = source.replace('-booking-suggestions.csv', '').replace(/^inbox-ledger-/, '');
    for (const row of parsed) {
      const hat = (row.Hat || 'review').toLowerCase();
      if (!row.Date?.includes(String(year))) continue;
      if (!filter(hat)) continue;
      const withdrawals = parseGermanAmount(row.Withdrawals || '0');
      const deposits = parseGermanAmount(row.Deposits || '0');
      const mapped = mapRow(row, bank, source, withdrawals, deposits);
      if (mapped) rows.push(mapped);
    }
  }
  return rows;
}

export function getInboxRows(year: number): InboxRow[] {
  return collectFromSuggestions<InboxRow>(
    year,
    (hat) => hat === 'review' || hat === 'liability_split',
    (row, bank, source, withdrawals, deposits) => ({
      date: row.Date,
      payee: row.Payee || row.Description || '',
      amount: withdrawals || deposits,
      hat: (row.Hat || 'review').toLowerCase(),
      suggestedAccount: row['Suggested Account'] || '',
      confidence: row.Confidence || '',
      bank: row['Source Bank Account'] || bank,
      source,
    })
  ).sort((a, b) => a.date.localeCompare(b.date));
}

export function getLedgerRows(year: number): LedgerRow[] {
  return collectFromSuggestions<LedgerRow>(
    year,
    (hat) => hat !== 'private' && hat !== 'transfer',
    (row, bank, _source, withdrawals, deposits) => {
      if (withdrawals <= 0 && deposits <= 0) return null;
      return {
        date: row.Date,
        payee: row.Payee || row.Description || '',
        amount: withdrawals || deposits,
        hat: (row.Hat || '').toLowerCase(),
        zeileHint: row['SKR Code'] ? `SKR ${row['SKR Code']}` : '',
        account: row['Suggested Account'] || '',
        bank: row['Source Bank Account'] || bank,
      };
    }
  ).sort((a, b) => a.date.localeCompare(b.date));
}

export function getPaths() {
  const root = dataRoot();
  const onVercel = Boolean(process.env.VERCEL);
  return {
    dataRoot: root,
    dataSource: onVercel || !fs.existsSync(root) ? 'bundled' : 'local',
    masterWorkbook: path.join(root, '!!_TAX-ADMIN', '250111_LDW_EÜR-seit2020-m-Vorlage.xlsx'),
    zohoBooks: zohoBooksDir(),
  };
}
