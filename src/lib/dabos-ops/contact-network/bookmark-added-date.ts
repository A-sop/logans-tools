/** Chrome `date_added` is microseconds since 1601-01-01 UTC (Windows epoch). */
const WINDOWS_EPOCH_OFFSET_MS = 11_644_473_600_000;

export function chromeAddDateToIso(addDate: string | number | null | undefined): string | null {
  if (addDate == null || addDate === '') return null;
  const micros = Number(addDate);
  if (!Number.isFinite(micros) || micros <= 0) return null;
  const ms = micros / 1000 - WINDOWS_EPOCH_OFFSET_MS;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function quarterKeyFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  return `${year}-Q${quarter}`;
}

export function quarterKeyFromChromeAddDate(addDate: string | number | null | undefined): string | null {
  return quarterKeyFromIso(chromeAddDateToIso(addDate));
}

export function parseQuarterArg(value: string): { year: number; quarter: number } | null {
  const match = /^(\d{4})-Q([1-4])$/i.exec(value.trim());
  if (!match) return null;
  return { year: Number(match[1]), quarter: Number(match[2]) };
}

/** ISO range for SQL filter on bookmark_added_at (UTC). */
export function quarterIsoRange(year: number, quarter: number): { start: string; end: string } {
  const startMonth = (quarter - 1) * 3;
  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, startMonth + 3, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}
