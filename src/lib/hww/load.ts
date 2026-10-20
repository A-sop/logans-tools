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

export function loadHwwSummaryLocal(): HwwSummary | null {
  const file = hwwFile('hww-summary.json');
  if (!file || !existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8')) as HwwSummary;
}

export function loadHwwRecordsLocal(): HwwRecord[] {
  const file = hwwFile('hww-records.json');
  if (!file || !existsSync(file)) return [];
  const raw = JSON.parse(readFileSync(file, 'utf8')) as { records?: HwwRecord[] } | HwwRecord[];
  if (Array.isArray(raw)) return raw;
  return raw.records ?? [];
}

/** @deprecated use loadHwwSummaryLocal or loadHwwSummary */
export function loadHwwSummary(): HwwSummary | null {
  return loadHwwSummaryLocal();
}

/** @deprecated use loadHwwRecordsLocal or loadHwwRecords */
export function loadHwwRecords(): HwwRecord[] {
  return loadHwwRecordsLocal();
}

export function requireHwwSummary(): HwwSummary {
  requireHwwDir();
  const s = loadHwwSummaryLocal();
  if (!s) notFound();
  return s;
}

function parseValue(v: string | null): number | string | null {
  if (v == null) return null;
  const n = Number(v);
  if (v.trim() !== '' && Number.isFinite(n) && String(n) === v.trim()) return n;
  return v;
}

export async function loadHwwSummaryFromNeon(): Promise<HwwSummary | null> {
  const { hasDabosDb, getDabosSql } = await import('@/lib/dabos/db');
  if (!hasDabosDb()) return null;
  const sql = getDabosSql();
  const rows = (await sql`
    SELECT summary, built_at
    FROM hww_summaries
    ORDER BY built_at DESC
    LIMIT 1
  `) as { summary: HwwSummary; built_at: string }[];
  if (!rows.length) return null;
  const s = rows[0].summary;
  if (s && typeof s === 'object') return s as HwwSummary;
  return null;
}

export async function loadHwwRecordsFromNeon(builtAt?: string): Promise<HwwRecord[]> {
  const { hasDabosDb, getDabosSql } = await import('@/lib/dabos/db');
  if (!hasDabosDb()) return [];
  const sql = getDabosSql();
  let target = builtAt;
  if (!target) {
    const latest = (await sql`
      SELECT built_at FROM hww_summaries ORDER BY built_at DESC LIMIT 1
    `) as { built_at: string }[];
    if (!latest.length) return [];
    target = latest[0].built_at;
  }
  const rows = (await sql`
    SELECT stat, date, stat_week, value, unit, area, kind, source_file, source_key, meta
    FROM hww_records
    WHERE built_at = ${target}::timestamptz
    ORDER BY date DESC, stat
  `) as {
    stat: string;
    date: string;
    stat_week: string | null;
    value: string | null;
    unit: string | null;
    area: string | null;
    kind: string | null;
    source_file: string;
    source_key: string;
    meta: Record<string, unknown> | null;
  }[];
  return rows.map((r) => ({
    stat: r.stat,
    date: r.date,
    stat_week: r.stat_week ?? undefined,
    value: parseValue(r.value),
    unit: r.unit ?? undefined,
    area: r.area ?? undefined,
    kind: r.kind ?? undefined,
    source_file: r.source_file,
    source_key: r.source_key,
    meta: r.meta ?? undefined,
  }));
}

/** Local DATA when present; otherwise latest Neon snapshot (production). */
export async function resolveHwwSummary(): Promise<HwwSummary | null> {
  if (getHwwDataDir()) {
    return loadHwwSummaryLocal();
  }
  return loadHwwSummaryFromNeon();
}

export async function resolveHwwRecords(summary?: HwwSummary | null): Promise<HwwRecord[]> {
  if (getHwwDataDir()) {
    return loadHwwRecordsLocal();
  }
  return loadHwwRecordsFromNeon(summary?.built_at);
}
