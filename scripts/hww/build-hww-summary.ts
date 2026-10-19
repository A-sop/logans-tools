/**
 * Build local-only HWW summary + records under HWW_DATA_DIR.
 * Never prints raw health/finance totals to stdout beyond section headings.
 */
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { computePoints, type WisdomRow } from '../../src/lib/hww/points';
import { lastNStatWeeks, statWeekForDate } from '../../src/lib/hww/stat-week';

const HWW = process.env.HWW_DATA_DIR?.trim() || 'C:\\DATA\\20_ADMIN\\!_HWW';
const HEALTH = 'C:\\DATA\\20_ADMIN\\!_HEALTH';
const FINANCE = 'C:\\DATA\\20_ADMIN\\!_FINANCE-TRACKER';
const BOOK = path.join(FINANCE, 'ldw-books.gnucash');
const DEBTS = path.join(FINANCE, 'debt', 'debts.csv');

type Rec = {
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

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') inQ = false;
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') {
      row.push(cur);
      cur = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
    } else cur += c;
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim()));
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function daysAgo(iso: string, days: number): boolean {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return true;
  return Date.now() - t > days * 86400_000;
}

function loadRenpho(): { rows: Record<string, unknown>[]; source: string; stale: boolean } {
  const latest = path.join(HEALTH, 'renpho', 'latest.json');
  if (!existsSync(latest)) return { rows: [], source: latest, stale: true };
  const payload = JSON.parse(readFileSync(latest, 'utf8')) as {
    measurements?: Record<string, unknown>[];
  };
  const rows = payload.measurements ?? [];
  const newest = String(rows[0]?.measured_at ?? '');
  return { rows, source: latest, stale: !newest || daysAgo(newest, 3) };
}

function loadIntervalsMerged(): Map<string, Record<string, unknown>> {
  const dir = path.join(HEALTH, 'intervals');
  const byDate = new Map<string, { row: Record<string, unknown>; mtime: number; file: string }>();
  if (!existsSync(dir)) return new Map();
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.join(dir, f));
  for (const file of files) {
    let payload: { wellness?: Record<string, unknown>[]; synced_at?: string };
    try {
      payload = JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      continue;
    }
    const mtime = existsSync(file) ? Date.parse(payload.synced_at ?? '') || 0 : 0;
    for (const w of payload.wellness ?? []) {
      const id = String(w.id ?? '');
      if (!id) continue;
      const prev = byDate.get(id);
      if (!prev || mtime >= prev.mtime) byDate.set(id, { row: w, mtime, file });
    }
  }
  const out = new Map<string, Record<string, unknown>>();
  for (const [id, v] of byDate) out.set(id, { ...v.row, _source_file: v.file });
  return out;
}

function skeletalPct(r: Record<string, unknown>): number | null {
  const v = r.skeletal_muscle_pct ?? r.muscle_kg;
  return typeof v === 'number' ? v : v != null ? Number(v) : null;
}
function proteinPct(r: Record<string, unknown>): number | null {
  const v = r.protein_pct ?? r.protein_kg;
  return typeof v === 'number' ? v : v != null ? Number(v) : null;
}
function muscleMassKg(r: Record<string, unknown>): number | null {
  if (typeof r.muscle_mass_kg === 'number') return r.muscle_mass_kg;
  const raw = r.raw as Record<string, unknown> | undefined;
  if (raw && raw.sinew != null) return Number(raw.sinew);
  return null;
}

function nyeTargetKg(isoDate: string): number {
  const start = Date.parse('2026-09-29T00:00:00Z');
  const end = Date.parse('2026-12-31T00:00:00Z');
  const t = Date.parse(isoDate);
  if (!Number.isFinite(t)) return 115;
  const u = Math.min(1, Math.max(0, (t - start) / (end - start)));
  return 122.7 + (115 - 122.7) * u;
}

function loadWisdom(records: Rec[]): {
  byWeek: Record<string, { points: number; byKind: Record<string, number>; words: number; units: number }>;
  flags: string[];
} {
  const logPath = path.join(HWW, 'wisdom-log.csv');
  const flags: string[] = [];
  const byWeek: Record<
    string,
    { points: number; byKind: Record<string, number>; words: number; units: number }
  > = {};
  if (!existsSync(logPath)) {
    flags.push('wisdom log missing');
    return { byWeek, flags };
  }
  const rows = parseCsv(readFileSync(logPath, 'utf8'));
  if (!rows.length) return { byWeek, flags };
  const header = rows[0].map((h) => h.trim());
  const idx = (name: string) => header.indexOf(name);
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const get = (name: string) => r[idx(name)]?.trim() ?? '';
    const row: WisdomRow = {
      date: get('date'),
      kind: get('kind'),
      demo_form: get('demo_form'),
      area: get('area'),
      count: Number(get('count') || '1'),
      pointsTyped: get('points'),
      title: get('title'),
      source_ref: get('source_ref'),
      path: get('path'),
      checkout: get('checkout'),
      hours: get('hours'),
      notes: get('notes'),
      lineNo: i + 1,
    };
    if (!row.date || !row.kind) continue;
    const scored = computePoints(row);
    for (const f of scored.flags) flags.push(`wisdom L${row.lineNo}: ${f}`);
    const week = statWeekForDate(row.date);
    if (!byWeek[week]) byWeek[week] = { points: 0, byKind: {}, words: 0, units: 0 };
    byWeek[week].points += scored.points;
    byWeek[week].byKind[row.kind] = (byWeek[week].byKind[row.kind] ?? 0) + scored.points;
    if (row.kind === 'word') byWeek[week].words += row.count || 1;
    if (row.kind === 'checksheet_item' || row.kind === 'wbt_module') {
      byWeek[week].units += row.count || 1;
    }
    records.push({
      stat: 'student_points',
      date: row.date,
      stat_week: week,
      value: scored.points,
      unit: 'points',
      area: row.area,
      kind: row.kind,
      source_file: 'wisdom-log.csv',
      source_key: `L${row.lineNo}`,
      meta: {
        title: row.title,
        demo_form: row.demo_form,
        checkout: row.checkout,
        path: row.path,
        source_ref: row.source_ref,
      },
    });
    if (row.kind === 'word') {
      records.push({
        stat: 'words_cleared',
        date: row.date,
        stat_week: week,
        value: row.title,
        unit: 'word',
        area: row.area,
        kind: row.kind,
        source_file: 'wisdom-log.csv',
        source_key: `L${row.lineNo}`,
        meta: { source_ref: row.source_ref },
      });
    }
  }
  return { byWeek, flags };
}

function loadDebtsTotal(): { total: number | null; rows: number; source: string } {
  if (!existsSync(DEBTS)) return { total: null, rows: 0, source: DEBTS };
  const rows = parseCsv(readFileSync(DEBTS, 'utf8'));
  if (rows.length < 2) return { total: 0, rows: 0, source: DEBTS };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const balIdx =
    header.findIndex((h) => h.includes('balance') || h.includes('amount') || h.includes('owed')) ?? -1;
  let total = 0;
  let n = 0;
  for (let i = 1; i < rows.length; i++) {
    const raw = balIdx >= 0 ? rows[i][balIdx] : '';
    const v = Number(String(raw).replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(v)) {
      total += v;
      n++;
    }
  }
  return { total, rows: n, source: DEBTS };
}

function readGnuCash(): Record<string, unknown> {
  const lck = BOOK + '.LCK';
  if (existsSync(lck)) {
    return { ok: false, error: 'LCK_PRESENT', provisional: true };
  }
  const script = path.join(__dirname, 'read-gnucash-totals.py');
  const r = spawnSync('python', [script, '--book', BOOK], { encoding: 'utf8', timeout: 120_000 });
  if (r.status !== 0 && !r.stdout) {
    return { ok: false, error: r.stderr?.slice(0, 200) || 'GNUCASH_READ_FAILED', provisional: true };
  }
  try {
    return JSON.parse(r.stdout.trim().split('\n').pop() || '{}');
  } catch {
    return { ok: false, error: 'GNUCASH_JSON_PARSE', provisional: true };
  }
}

function loadScreenshotFlags(): { flags: string[]; count: number } {
  const p = path.join(HEALTH, 'renpho', 'screenshot-readings.csv');
  if (!existsSync(p)) return { flags: [], count: 0 };
  const rows = parseCsv(readFileSync(p, 'utf8'));
  if (rows.length < 2) return { flags: [], count: 0 };
  const header = rows[0];
  const fi = header.indexOf('flag');
  const mi = header.indexOf('metric');
  const flags: string[] = [];
  for (let i = 1; i < rows.length; i++) {
    const flag = rows[i][fi] ?? '';
    const metric = rows[i][mi] ?? '';
    if (flag && flag !== 'ok') flags.push(`screenshot ${metric}: ${flag}`);
  }
  return { flags, count: rows.length - 1 };
}

function main() {
  mkdirSync(HWW, { recursive: true });
  mkdirSync(path.join(HWW, 'evidence'), { recursive: true });

  const records: Rec[] = [];
  const flags: string[] = [];

  // --- Health ---
  const renpho = loadRenpho();
  if (renpho.stale) flags.push('Renpho stale');
  const last120 = renpho.rows.slice(0, 200).filter((r) => {
    const at = String(r.measured_at ?? '');
    const t = Date.parse(at);
    return Number.isFinite(t) && Date.now() - t <= 120 * 86400_000;
  });
  for (const r of last120) {
    const at = String(r.measured_at ?? '');
    const day = at.slice(0, 10);
    const w = r.weight_kg;
    if (typeof w === 'number') {
      records.push({
        stat: 'weight_kg',
        date: day,
        value: w,
        unit: 'kg',
        source_file: renpho.source,
        source_key: String(r.id ?? at),
        meta: { nye_line_kg: nyeTargetKg(at), measured_at: at },
      });
    }
    const bf = r.bodyfat_pct;
    if (typeof bf === 'number') {
      records.push({
        stat: 'bodyfat_pct',
        date: day,
        value: bf,
        unit: '%',
        source_file: renpho.source,
        source_key: String(r.id ?? at),
      });
    }
    const sm = skeletalPct(r);
    if (sm != null && Number.isFinite(sm)) {
      records.push({
        stat: 'skeletal_muscle_pct',
        date: day,
        value: sm,
        unit: '%',
        source_file: renpho.source,
        source_key: String(r.id ?? at),
      });
    }
    const mm = muscleMassKg(r);
    if (mm != null && Number.isFinite(mm)) {
      records.push({
        stat: 'muscle_mass_kg',
        date: day,
        value: mm,
        unit: 'kg',
        source_file: renpho.source,
        source_key: String(r.id ?? at),
      });
    }
    const pp = proteinPct(r);
    if (pp != null && Number.isFinite(pp)) {
      records.push({
        stat: 'protein_pct',
        date: day,
        value: pp,
        unit: '%',
        source_file: renpho.source,
        source_key: String(r.id ?? at),
      });
    }
  }

  const wellness = loadIntervalsMerged();
  const wellnessDates = [...wellness.keys()].sort();
  const last28 = wellnessDates.slice(-28);
  const last7 = wellnessDates.slice(-7);
  const series = (dates: string[], key: string) =>
    dates
      .map((d) => wellness.get(d)?.[key])
      .filter((v): v is number => typeof v === 'number');

  for (const d of wellnessDates) {
    const w = wellness.get(d)!;
    const src = String(w._source_file ?? 'intervals');
    for (const [stat, key, unit] of [
      ['steps', 'steps', 'steps'],
      ['sleep_score', 'sleepScore', 'score'],
      ['sleep_secs', 'sleepSecs', 's'],
      ['rhr', 'restingHR', 'bpm'],
      ['hrv', 'hrv', 'ms'],
      ['vo2max', 'vo2max', 'ml/kg/min'],
    ] as const) {
      const v = w[key];
      if (v == null) continue;
      records.push({
        stat,
        date: d,
        value: typeof v === 'number' ? v : Number(v),
        unit,
        source_file: src,
        source_key: d,
      });
    }
  }

  const shot = loadScreenshotFlags();
  flags.push(...shot.flags);

  // --- Wealth ---
  const gc = readGnuCash();
  const debts = loadDebtsTotal();
  if (gc.ok) {
    for (const a of (gc.asset_accounts as { path: string; balance: number }[]) ?? []) {
      records.push({
        stat: 'asset_account',
        date: new Date().toISOString().slice(0, 10),
        value: a.balance,
        unit: 'EUR',
        source_file: String(gc.source ?? BOOK),
        source_key: a.path,
      });
    }
    for (const a of (gc.liability_accounts as { path: string; balance: number }[]) ?? []) {
      records.push({
        stat: 'liability_account',
        date: new Date().toISOString().slice(0, 10),
        value: a.balance,
        unit: 'EUR',
        source_file: String(gc.source ?? BOOK),
        source_key: a.path,
      });
    }
  } else {
    flags.push(`GnuCash: ${String(gc.error)}`);
  }
  if (debts.total != null) {
    records.push({
      stat: 'debts_csv_total',
      date: new Date().toISOString().slice(0, 10),
      value: debts.total,
      unit: 'EUR',
      source_file: debts.source,
      source_key: `rows:${debts.rows}`,
    });
  }
  const gap =
    gc.ok && debts.total != null
      ? Math.abs(Number(gc.liabilities_total) - debts.total)
      : null;
  if (gap != null) {
    flags.push('wealth liability gap book vs debts.csv computed (see summary)');
  }

  // --- Wisdom ---
  const wisdom = loadWisdom(records);
  flags.push(...wisdom.flags);
  const weeks = lastNStatWeeks(13);
  const wisdomWeeks = weeks.map((w) => ({
    week_ending: w,
    student_points: wisdom.byWeek[w]?.points ?? 0,
    by_kind: wisdom.byWeek[w]?.byKind ?? {},
    words_cleared: wisdom.byWeek[w]?.words ?? 0,
    units: wisdom.byWeek[w]?.units ?? 0,
    in_progress: w === weeks[0],
  }));

  // Self-check: student_points sum per week
  for (const w of wisdomWeeks) {
    const sum = records
      .filter((r) => r.stat === 'student_points' && r.stat_week === w.week_ending)
      .reduce((a, r) => a + Number(r.value ?? 0), 0);
    if (Math.abs(sum - w.student_points) > 0.01) {
      throw new Error(`self-check fail student_points week ${w.week_ending}: ${sum} vs ${w.student_points}`);
    }
  }

  const latestRenpho = renpho.rows[0] ?? {};
  const summary = {
    built_at: new Date().toISOString(),
    provisional_wealth: true,
    sections: ['health', 'wealth', 'wisdom'],
    flags,
    health: {
      renpho_stale: renpho.stale,
      latest_measured_at: latestRenpho.measured_at ?? null,
      latest_weight_kg: latestRenpho.weight_kg ?? null,
      latest_bodyfat_pct: latestRenpho.bodyfat_pct ?? null,
      latest_skeletal_muscle_pct: skeletalPct(latestRenpho),
      latest_protein_pct: proteinPct(latestRenpho),
      latest_muscle_mass_kg: muscleMassKg(latestRenpho),
      weight_series_days: last120.length,
      nye_band_kg: [114, 116],
      steps_avg_7d: avg(series(last7, 'steps')),
      steps_avg_28d: avg(series(last28, 'steps')),
      sleep_score_avg_7d: avg(series(last7, 'sleepScore')),
      sleep_score_avg_28d: avg(series(last28, 'sleepScore')),
      rhr_avg_7d: avg(series(last7, 'restingHR')),
      rhr_avg_28d: avg(series(last28, 'restingHR')),
      hrv_avg_7d: avg(series(last7, 'hrv')),
      hrv_avg_28d: avg(series(last28, 'hrv')),
      vo2max_latest: (() => {
        for (let i = wellnessDates.length - 1; i >= 0; i--) {
          const v = wellness.get(wellnessDates[i])?.vo2max;
          if (typeof v === 'number') return v;
        }
        return null;
      })(),
      screenshot_discrepancy_flags: shot.flags,
      field_names: ['skeletal_muscle_pct', 'protein_pct', 'muscle_mass_kg'],
    },
    wealth: {
      provisional: true,
      note: 'provisional - books correction in progress; net worth = assets − liabilities (surrogate, not DABOS official)',
      assets_total: gc.ok ? gc.assets_total : null,
      liabilities_total: gc.ok ? gc.liabilities_total : null,
      net_worth_eur: gc.ok ? gc.net_worth : null,
      gnucash_ok: Boolean(gc.ok),
      gnucash_error: gc.ok ? null : gc.error,
      debts_csv_total: debts.total,
      liability_gap_abs: gap,
      education_gauge: null,
      education_gauge_omitted_reason:
        'No clear education expense accounts mapped for trailing-12m income; omit rather than guess',
      as_of: new Date().toISOString().slice(0, 10),
    },
    wisdom: {
      weeks: wisdomWeeks,
      current_week: weeks[0],
      vs_previous_points:
        (wisdom.byWeek[weeks[0]]?.points ?? 0) - (wisdom.byWeek[weeks[1]]?.points ?? 0),
      empty: Object.keys(wisdom.byWeek).length === 0,
    },
  };

  writeFileSync(path.join(HWW, 'hww-summary.json'), JSON.stringify(summary, null, 2), 'utf8');
  writeFileSync(
    path.join(HWW, 'hww-records.json'),
    JSON.stringify({ built_at: summary.built_at, records }, null, 2),
    'utf8',
  );

  const snapPath = path.join(HWW, 'hww-snapshots.csv');
  if (!existsSync(snapPath)) {
    writeFileSync(
      snapPath,
      'date,weight_kg,steps_avg_7d,sleep_score_avg_7d,rhr_avg_7d,hrv_avg_7d,vo2max_latest,net_worth_eur,student_points_stat_week,words_cleared_stat_week,units_stat_week\n',
      'utf8',
    );
  }
  const cw = wisdomWeeks[0];
  appendFileSync(
    snapPath,
    [
      summary.built_at.slice(0, 10),
      summary.health.latest_weight_kg ?? '',
      summary.health.steps_avg_7d ?? '',
      summary.health.sleep_score_avg_7d ?? '',
      summary.health.rhr_avg_7d ?? '',
      summary.health.hrv_avg_7d ?? '',
      summary.health.vo2max_latest ?? '',
      summary.wealth.net_worth_eur ?? '',
      cw?.student_points ?? 0,
      cw?.words_cleared ?? 0,
      cw?.units ?? 0,
    ].join(',') + '\n',
    'utf8',
  );

  console.log('HWW_BUILD_OK');
  console.log('sections:', summary.sections.join(', '));
  console.log('flags_count:', flags.length);
  console.log('records:', records.length);
  console.log('wrote:', path.join(HWW, 'hww-summary.json'));
}

main();
