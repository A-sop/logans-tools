/** Empirical percentile rank (0–100, two decimal places) within `series`. */
export function percentileRank(value: number, series: number[]): number {
  if (series.length === 0 || !Number.isFinite(value)) return 0;
  const sorted = [...series].filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return 50;

  let below = 0;
  let equal = 0;
  for (const v of sorted) {
    if (v < value) below += 1;
    else if (v === value) equal += 1;
  }
  const pct = ((below + equal / 2) / sorted.length) * 100;
  return roundPercentile(pct);
}

export function roundPercentile(pct: number): number {
  return Math.round(Math.min(100, Math.max(0, pct)) * 100) / 100;
}

/** Map each point to its percentile within the full series (same-length array). */
export function percentileSeries(values: number[]): number[] {
  return values.map((v, i) => percentileRank(v, values.slice(0, i + 1)));
}
