/**
 * Dept1 per-capture router (intake-classification-hat.md).
 *
 *   npx tsx scripts/dabos/route-captures.ts --plan <plan.json> --source telegram|youtube [--dry-run]
 *
 * Plan entries: { bundle, dept, owner, alt, kind, routed_reason, title, summary, urls }.
 * telegram: bundle = ingest_meta.wiki_bundle; youtube: bundle = ingest_external_id (video id).
 * Only open tasks still in Dept1 move. Every affected row is backed up first to
 * C:\DATA\10_WORK\dabos-rollback\<day>-route-captures.csv (batch column).
 * Empty captures ('[link]', '(media only)') get the fetched title/summary.
 * Exact-URL duplicates are kept (never closed) and raise priority. DVAG matches: no text, counts only.
 */
import fs from 'fs';
import path from 'path';

import { createDabosSql } from '../../src/lib/dabos/dabos-connection';
import { DVAG_KEYWORD_REGEX } from '../../src/lib/dabos/ingest';
import { requireDatabaseUrl } from './load-env';

type PlanItem = {
  bundle: string;
  dept: string;
  owner?: string;
  alt?: string;
  kind: string;
  routed_reason: string;
  title?: string;
  summary?: string;
  urls?: string[];
};

const EMPTY_TITLES = new Set(['[link]', '(media only)', 'capture', '(empty)']);
const ROLLBACK_DIR = process.env.DABOS_ROLLBACK_DIR || 'C:\\DATA\\10_WORK\\dabos-rollback';

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

function csvCell(v: unknown): string {
  const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return '"' + s.replace(/"/g, '""') + '"';
}

export function isEmptyTitle(title: string): boolean {
  const t = title.trim().toLowerCase();
  return EMPTY_TITLES.has(t) || /^https?:\/\//.test(t);
}

async function main() {
  const planPath = arg('--plan');
  const source = arg('--source') || 'telegram';
  const dry = process.argv.includes('--dry-run');
  if (!planPath) throw new Error('--plan required');
  const plan: PlanItem[] = JSON.parse(fs.readFileSync(planPath, 'utf8').replace(/^\uFEFF/, ''));
  const sql: any = createDabosSql(requireDatabaseUrl());
  const depts = await sql`SELECT id, division_id FROM departments`;
  const divOf = new Map<string, string>(depts.map((d: any) => [String(d.id), String(d.division_id)]));

  const open = await sql`
    SELECT id, department_id, division_id, status, priority, title, description, ingest_external_id, ingest_meta
    FROM tasks
    WHERE ingest_source = ${source} AND status NOT IN ('done', 'cancelled')`;
  const key = (t: any) => (source === 'telegram' ? t.ingest_meta?.wiki_bundle : t.ingest_external_id);
  const byBundle = new Map<string, any>();
  for (const t of open) if (key(t)) byBundle.set(String(key(t)), t);

  const batch = `route-captures-${source}-${new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)}`;
  const day = new Date().toISOString().slice(0, 10);
  const backup = path.join(ROLLBACK_DIR, `${day}-route-captures.csv`);
  const cols = ['batch', 'id', 'department_id', 'division_id', 'status', 'priority', 'title', 'description', 'ingest_meta'];
  const lines: string[] = [];
  const counts: Record<string, number> = {};
  const updates: { t: any; item: PlanItem }[] = [];
  let missing = 0;
  for (const item of plan) {
    const t = byBundle.get(item.bundle);
    if (!t) { missing++; continue; }
    if (t.department_id !== 'Dept1') continue; // already owned elsewhere; never override another dept
    if (!divOf.has(item.dept)) throw new Error(`unknown dept ${item.dept}`);
    updates.push({ t, item });
    lines.push([batch, ...cols.slice(1).map((c) => t[c])].map(csvCell).join(','));
  }
  if (!dry && updates.length) {
    fs.mkdirSync(ROLLBACK_DIR, { recursive: true });
    if (!fs.existsSync(backup)) fs.writeFileSync(backup, cols.join(',') + '\n', 'utf8');
    fs.appendFileSync(backup, lines.join('\n') + '\n', 'utf8');
  }
  let filled = 0;
  for (const { t, item } of updates) {
    const dvag = DVAG_KEYWORD_REGEX.test(`${item.title ?? ''} ${item.summary ?? ''} ${t.title ?? ''}`);
    const reason = dvag ? 'DVAG item: tracked in Proviso case index (counts only)' : item.routed_reason;
    let title = String(t.title);
    let description = String(t.description ?? '');
    if (!dvag && isEmptyTitle(title) && item.title && !isEmptyTitle(item.title)) {
      title = item.title.slice(0, 200);
      filled++;
      if (item.summary) description = `${description}\nContent (Dept1 fill): ${item.summary}`;
    }
    const meta = {
      ...(t.ingest_meta || {}),
      routed_reason: reason,
      routed_by: 'Dept1',
      routed_at: new Date().toISOString(),
      route_kind: item.kind,
      route_candidates: [item.owner, item.alt].filter(Boolean),
      route_batch: batch,
      ...(item.kind === 'blocked_login' ? { blocked: 'needs_logan_login' } : {}),
    };
    counts[`${item.kind}:${item.dept}`] = (counts[`${item.kind}:${item.dept}`] || 0) + 1;
    if (dry) continue;
    await sql`
      UPDATE tasks SET department_id = ${item.dept}, division_id = ${divOf.get(item.dept)!},
        title = ${title}, description = ${description}, ingest_meta = ${JSON.stringify(meta)}::jsonb,
        updated_at = now()
      WHERE id = ${t.id} AND department_id = 'Dept1'`;
  }
  // Exact full-URL duplicates across open telegram + youtube captures: keep all, raise priority one step.
  const all = await sql`
    SELECT id, department_id, division_id, status, priority, title, description, ingest_source, ingest_external_id, ingest_meta
    FROM tasks WHERE ingest_source IN ('telegram', 'youtube') AND status NOT IN ('done', 'cancelled')`;
  const planUrls = new Map<string, string[]>(plan.map((i) => [i.bundle, i.urls ?? []]));
  const groups = new Map<string, any[]>();
  for (const t of all) {
    const urls = new Set<string>();
    for (const u of t.ingest_meta?.urls ?? []) urls.add(String(u));
    for (const u of String(t.description ?? '').match(/https?:\/\/\S+/g) ?? []) urls.add(u);
    const b = t.ingest_source === 'telegram' ? t.ingest_meta?.wiki_bundle : null;
    for (const u of (b && planUrls.get(b)) || []) urls.add(u);
    for (const u of urls) groups.set(u, [...(groups.get(u) ?? []), t]);
  }
  const dupGroups = [...groups.entries()].filter(([, ts]) => new Set(ts.map((x: any) => x.id)).size > 1);
  const raisedIds = new Set<string>();
  const dupLines: string[] = [];
  for (const [url, ts] of dupGroups) {
    const uniq = [...new Map(ts.map((x: any) => [x.id, x])).values()] as any[];
    const minP = Math.min(...uniq.map((x) => Number(x.priority ?? 3)));
    const raised = Math.max(1, minP - 1);
    for (const t of uniq) {
      if (raisedIds.has(t.id) || t.ingest_meta?.dup_raised) continue;
      raisedIds.add(t.id);
      dupLines.push([batch + '-dup', ...cols.slice(1).map((c) => t[c])].map(csvCell).join(','));
      if (dry) continue;
      if (!fs.existsSync(backup)) fs.writeFileSync(backup, cols.join(',') + '\n', 'utf8');
      fs.appendFileSync(backup, dupLines[dupLines.length - 1] + '\n', 'utf8'); // backup before write
      const meta = { ...(t.ingest_meta || {}), dup_raised: true, dup_count: uniq.length, dup_url_group: url.slice(0, 300) };
      await sql`UPDATE tasks SET priority = ${raised}, ingest_meta = ${JSON.stringify(meta)}::jsonb, updated_at = now() WHERE id = ${t.id}`;
    }
  }
  console.log(JSON.stringify({ source, dry, plan: plan.length, matched: updates.length, missing, filled, counts,
    dup_groups: dupGroups.length, dup_tasks_raised: raisedIds.size, backup: dry ? null : backup }));
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
