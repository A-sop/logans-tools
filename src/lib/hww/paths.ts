import { existsSync } from 'node:fs';
import path from 'node:path';

export const DEFAULT_HWW_DATA_DIR = 'C:\\DATA\\20_ADMIN\\!_HWW';
export const DEFAULT_HEALTH_DIR = 'C:\\DATA\\20_ADMIN\\!_HEALTH';
export const DEFAULT_FINANCE_DIR = 'C:\\DATA\\20_ADMIN\\!_FINANCE-TRACKER';

export function getHwwDataDir(): string | null {
  const fromEnv = process.env.HWW_DATA_DIR?.trim();
  const dir = fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_HWW_DATA_DIR;
  if (!existsSync(dir)) return null;
  return dir;
}

export function hwwFile(...parts: string[]): string | null {
  const root = getHwwDataDir();
  if (!root) return null;
  return path.join(root, ...parts);
}

export function evidenceRoot(): string | null {
  const root = getHwwDataDir();
  if (!root) return null;
  return path.join(root, 'evidence');
}

/** Resolve evidence path; null if traversal or outside evidence root. */
export function resolveEvidencePath(relParts: string[]): string | null {
  const root = evidenceRoot();
  if (!root) return null;
  const joined = path.resolve(root, ...relParts);
  const normalizedRoot = path.resolve(root);
  if (!joined.startsWith(normalizedRoot + path.sep) && joined !== normalizedRoot) {
    return null;
  }
  if (!existsSync(joined)) return null;
  return joined;
}
