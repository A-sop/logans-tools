/**
 * Read-only Div1 artifacts_indexed check (RR-010 step 0; ln02 wrapper: ops/ln02/bin/dabos-div1-dry-run.sh).
 * Run: npm run dabos:div1-dry-run [-- --week=2026-W44]   (default: the last closed org week)
 *
 * Computes Div1 with the poster's own code and env (DABOS_WIKI_REPO_ROOT, else DABOS_REPO_ROOT;
 * DABOS_WIKI_GIT_REF; DABOS_WIKI_SOURCE) and compares it with the active Neon Div1 row of that week.
 * SELECTs only: this file never inserts, updates or deletes.
 * Exit: 0 ok (and equal to the active row when one exists), 2 NOT POSTED, 3 differs, 1 error.
 */
import { execFileSync } from 'child_process';

import { computeArtifactsIndexedWeekly, DEFAULT_WIKI_GIT_REF } from '../../src/lib/dabos/artifacts-indexed';
import { createDabosSql } from '../../src/lib/dabos/dabos-connection';
import {
  loadPreviousDiv1Fingerprints,
  resolveDiv1WikiRepoRoot,
} from '../../src/lib/dabos/division-weekly-stats';
import {
  closedOrgWeek,
  closedOrgWeekForIsoWeek,
  type ClosedOrgWeek,
} from '../../src/lib/dabos/org-week-window';
import { requireDatabaseUrl } from './load-env';

function parseWeekArg(): ClosedOrgWeek {
  const args = process.argv.filter((a) => a === '--week' || a.startsWith('--week='));
  if (args.length === 0) return closedOrgWeek();
  if (args.length > 1) throw new Error('--week given more than once');
  const raw = args[0]!.slice('--week='.length);
  const m = /^(\d{4})-W(\d{2})$/.exec(raw);
  if (!m) throw new Error(`Invalid --week '${raw}': expected YYYY-Www, e.g. --week=2026-W44`);
  const year = Number(m[1]);
  const week = Number(m[2]);
  const w = week >= 1 && week <= 53 ? closedOrgWeekForIsoWeek(year, week) : null;
  if (!w || w.isoYear !== year || w.isoWeek !== week) {
    throw new Error(`Invalid --week '${raw}': ISO week ${week} does not exist in ${year}`);
  }
  return w;
}

function gitOut(root: string, args: string[]): string {
  try {
    return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

async function main() {
  const window = parseWeekArg();
  if (window.end.getTime() > Date.now()) {
    console.error(`${window.id} has not closed yet (closes ${window.end.toISOString()}); nothing to check`);
    process.exit(1);
  }
  const workspaceId = `div-live-${window.isoYear}-W${String(window.isoWeek).padStart(2, '0')}`;
  const repoRoot = resolveDiv1WikiRepoRoot();
  const gitRef = process.env.DABOS_WIKI_GIT_REF?.trim() || DEFAULT_WIKI_GIT_REF;
  const source = process.env.DABOS_WIKI_SOURCE?.trim() === 'snapshot' ? 'snapshot' : 'auto';
  const sql = createDabosSql(requireDatabaseUrl());

  console.log(`# Div1 artifacts_indexed dry run (read-only) for ${workspaceId}`);
  console.log(`window      : ${window.start.toISOString()} -> ${window.end.toISOString()}`);
  console.log(`wiki root   : ${repoRoot} (source ${source})`);
  console.log(`git ref     : ${gitRef} = ${gitOut(repoRoot, ['rev-parse', '--short=8', `refs/remotes/${gitRef}`]) || '(none)'}`);

  const res = await computeArtifactsIndexedWeekly({
    window,
    repoRoot,
    gitRef,
    source,
    loadPreviousFingerprints: () => loadPreviousDiv1Fingerprints(sql, window),
  });

  const rows = (await sql`
    select value, basis from stats
    where workspace_id = ${workspaceId}
      and division_id = 'Div1'
      and department_id is null
      and metric_key = 'artifacts_indexed'
      and superseded_at is null
    order by recorded_at desc
    limit 1
  `) as Array<{ value: unknown; basis: unknown }>;
  if ('end' in sql && typeof sql.end === 'function') await sql.end({ timeout: 5 });

  if (!res.ok) {
    console.log(`RESULT      : NOT POSTED - ${res.reason}`);
    process.exit(2);
  }
  const b = res.basis;
  console.log(`RESULT      : would post Div1 artifacts_indexed = ${res.value}`);
  console.log(`method      : ${b.method} (start ${b.start_source}); pages ${b.pages_at_start} -> ${b.pages_at_end}, +${b.pages_added} / -${b.pages_removed}`);
  if (b.method === 'git') {
    console.log(`git commits : ${b.git_start_commit?.slice(0, 8) ?? '-'} -> ${b.git_end_commit?.slice(0, 8) ?? '-'}; fetched ${b.git_fetched_at} via ${b.git_fetch_signal}`);
  }

  const row = rows[0];
  if (!row) {
    console.log(`neon        : no active ${workspaceId} Div1 row yet (nothing to compare)`);
    process.exit(0);
  }
  const stored = (typeof row.basis === 'string' ? JSON.parse(row.basis) : row.basis) as {
    git_end_commit?: unknown;
    page_fingerprints?: unknown;
  } | null;
  const storedFps = Array.isArray(stored?.page_fingerprints) ? (stored!.page_fingerprints as string[]) : [];
  const sameValue = Number(row.value) === res.value;
  const sameEnd = (stored?.git_end_commit ?? null) === (b.git_end_commit ?? null);
  const sameFps = storedFps.length === b.page_fingerprints.length && storedFps.every((f, i) => f === b.page_fingerprints[i]);
  console.log(
    `neon        : active row value=${Number(row.value)}; value ${sameValue ? 'MATCH' : 'DIFF'}, git_end_commit ${sameEnd ? 'MATCH' : 'DIFF'}, fingerprints ${sameFps ? 'MATCH' : 'DIFF'} (${storedFps.length} vs ${b.page_fingerprints.length})`
  );
  process.exit(sameValue && sameEnd && sameFps ? 0 : 3);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
