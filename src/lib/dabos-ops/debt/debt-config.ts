import * as path from 'path';
import type { DebtPaths, DebtSettings } from '@/lib/dabos-ops/debt/debt-types';

const DEFAULT_ROOT = 'C:\\DATA\\10_WORK\\Atlas-Debt';
// Where the original CSV tracker lives (one-time seed source).
const DEFAULT_SEED_DIR = 'C:\\DATA\\20_ADMIN\\!_FINANCE-TRACKER\\debt';

function readEnv(name: string): string | null {
  const value = process.env[name];
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getDebtPaths(): DebtPaths {
  // Prefer DABOS_*; ATLAS_* kept as fallback for older .env.local copies.
  const root = readEnv('DABOS_DEBT_ROOT') ?? readEnv('ATLAS_DEBT_ROOT') ?? DEFAULT_ROOT;
  const dbPath =
    readEnv('DABOS_DEBT_DB_PATH') ??
    readEnv('ATLAS_DEBT_DB_PATH') ??
    path.join(root, 'atlas-debt.db');
  const seedDir = readEnv('DABOS_DEBT_SEED_DIR') ?? readEnv('ATLAS_DEBT_SEED_DIR') ?? DEFAULT_SEED_DIR;
  return { root, dbPath, seedDir };
}

export const DEFAULT_SETTINGS: DebtSettings = {
  monthlyIncome: 1200,
  monthlyBudget: 1000,
  strategy: 'snowball',
  currency: 'EUR',
};
