/**
 * Parse personal-rudiments.md daily table into HWW-safe rows.
 * Never reads or exports the ruin answer block — private to the local file.
 */

export type RudimentDay = {
  date: string;
  slept: boolean | null;
  eaten: boolean | null;
  moved: boolean | null;
  workspace: boolean | null;
  no_upset: boolean | null;
  ruds_in: boolean | null;
};

function cellBool(raw: string): boolean | null {
  const t = raw.trim().toLowerCase();
  if (!t || t === '—' || t === '-') return null;
  if (/^(y|yes|true|1|✓|✔|x)$/i.test(t)) return true;
  if (/^(n|no|false|0)$/i.test(t)) return false;
  return null;
}

/** Extract daily-check table rows from rudiments markdown. Skips empty date cells. */
export function parseRudimentsMarkdown(md: string): RudimentDay[] {
  const lines = md.split(/\r?\n/);
  const out: RudimentDay[] = [];
  let inTable = false;
  for (const line of lines) {
    if (line.includes('| Date |') && line.includes('Ruds in')) {
      inTable = true;
      continue;
    }
    if (!inTable) continue;
    if (!line.trim().startsWith('|')) {
      if (inTable && out.length) break;
      continue;
    }
    if (/^\|\s*-+/.test(line)) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 7) continue;
    const date = cells[0] ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    out.push({
      date,
      slept: cellBool(cells[1] ?? ''),
      eaten: cellBool(cells[2] ?? ''),
      moved: cellBool(cells[3] ?? ''),
      workspace: cellBool(cells[4] ?? ''),
      no_upset: cellBool(cells[5] ?? ''),
      ruds_in: cellBool(cells[6] ?? ''),
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export function rudimentsSummaryFromDays(days: RudimentDay[], asOf = new Date()) {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const today = iso(asOf);
  const weekAgo = new Date(asOf);
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);
  const weekStart = iso(weekAgo);
  const last7 = days.filter((d) => d.date >= weekStart && d.date <= today);
  const inCount = last7.filter((d) => d.ruds_in === true).length;
  const outCount = last7.filter((d) => d.ruds_in === false).length;
  const latest = days[0] ?? null;
  return {
    as_of: today,
    days_logged: days.length,
    last_14: days.slice(0, 14),
    latest,
    ruds_in_days_7d: inCount,
    ruds_out_days_7d: outCount,
    today_status:
      latest?.date === today
        ? latest.ruds_in === true
          ? 'in'
          : latest.ruds_in === false
            ? 'out'
            : 'logged'
        : 'missing',
  };
}
