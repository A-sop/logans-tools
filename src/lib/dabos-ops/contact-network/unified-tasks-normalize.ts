import { createHash } from 'node:crypto';

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function dueWeekKey(dueDate: string | null | undefined): string {
  if (!dueDate) return '';
  const parsed = new Date(dueDate);
  if (Number.isNaN(parsed.getTime())) return '';
  const year = parsed.getUTCFullYear();
  const start = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((parsed.getTime() - start.getTime()) / 86_400_000 + start.getUTCDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function normalizeUrl(url: string | null | undefined): string {
  if (!url) return '';
  try {
    const parsed = new URL(url.trim());
    parsed.hash = '';
    let normalized = parsed.toString().toLowerCase();
    if (normalized.endsWith('/')) normalized = normalized.slice(0, -1);
    return normalized;
  } catch {
    return url.trim().toLowerCase().replace(/\/$/, '');
  }
}

export function buildDedupeKey(
  title: string,
  dueDate?: string | null,
  url?: string | null
): string {
  const urlNorm = normalizeUrl(url);
  if (urlNorm) return `url:${urlNorm}`;

  const norm = normalizeTitle(title);
  const week = dueWeekKey(dueDate ?? null);
  return `title:${norm}|due:${week}`;
}

export function stableExternalId(parts: Array<string | number | null | undefined>): string {
  const raw = parts
    .filter((part) => part !== null && part !== undefined && String(part).length > 0)
    .map((part) => String(part))
    .join('|');
  return createHash('sha256').update(raw).digest('hex').slice(0, 20);
}
