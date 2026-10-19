import { existsSync, readFileSync } from 'node:fs';
import { notFound } from 'next/navigation';
import { getHwwDataDir, hwwFile } from './paths';

export type HwwSummary = {
  built_at: string;
  provisional_wealth: boolean;
  health: Record<string, unknown>;
  wealth: Record<string, unknown>;
  wisdom: Record<string, unknown>;
  flags: string[];
  sections: string[];
};

export type HwwRecord = {
  stat: string;
  date: string;
  stat_week?: string;
  value: number | string | null;
  unit?: string;
  area?: string;
  kind?: string;
  source_file: string;
  source_key: string;
  meta?: Record<string, unknown>;
};

export function requireHwwDir(): string {
  const dir = getHwwDataDir();
  if (!dir) notFound();
  return dir;
}

export function loadHwwSummary(): HwwSummary | null {
  const file = hwwFile('hww-summary.json');
  if (!file || !existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8')) as HwwSummary;
}

export function loadHwwRecords(): HwwRecord[] {
  const file = hwwFile('hww-records.json');
  if (!file || !existsSync(file)) return [];
  const raw = JSON.parse(readFileSync(file, 'utf8')) as { records?: HwwRecord[] } | HwwRecord[];
  if (Array.isArray(raw)) return raw;
  return raw.records ?? [];
}

export function requireHwwSummary(): HwwSummary {
  requireHwwDir();
  const s = loadHwwSummary();
  if (!s) notFound();
  return s;
}
