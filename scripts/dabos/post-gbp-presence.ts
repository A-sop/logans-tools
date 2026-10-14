/**
 * Post Google Business Profile monthly performance onto Dept4.
 *
 * Credit is Dept4 (Promotion). Dept6 is the secondary hat in provenance only.
 * Run: npm run dabos:post-gbp-presence
 */
import { spawnSync } from 'child_process';
import path from 'path';

import { createDabosSql } from '../../src/lib/dabos/dabos-connection';
import {
  GBP_CREDIT_DEPARTMENT_ID,
  GBP_SECONDARY_HAT,
  parseGbpReport,
  postGbpPresenceStats,
  type GbpRawMessage,
} from '../../src/lib/dabos/gbp-presence';
import { requireDatabaseUrl } from './load-env';

const FETCH_SCRIPT = path.resolve(
  'C:/Dev/DABOS/scripts/dept01-intake/mail/fetch_gbp_performance.py'
);

function fetchMessages(): GbpRawMessage[] {
  const proc = spawnSync('python', [FETCH_SCRIPT], {
    encoding: 'utf-8',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  });
  if (proc.status !== 0) {
    const detail = (proc.stderr || proc.stdout || '').trim();
    throw new Error(detail || `GBP mail fetch failed (${proc.status})`);
  }
  const payload = JSON.parse(proc.stdout) as { reports?: GbpRawMessage[] };
  return payload.reports ?? [];
}

async function main() {
  const messages = fetchMessages();
  const reports = messages
    .map((message) => parseGbpReport(message))
    .filter((report) => report != null);
  if (reports.length === 0) {
    throw new Error(`No performance reports parsed from ${messages.length} Business Profile messages`);
  }

  const sql = createDabosSql(requireDatabaseUrl());
  const result = await postGbpPresenceStats(sql, reports);

  for (const month of result.months) {
    const split = month.listings
      .map((listing) => `${listing.listingId}=${listing.profileViews} views/${listing.interactions} interactions`)
      .join(', ');
    console.log(
      `gbp-presence-${month.period}: gbp_profile_views=${month.profileViews}, gbp_interactions=${month.interactions} (${split})`
    );
  }

  if (result.inserted.length === 0) {
    console.log('Already posted (idempotent). No new Dept4 credit receipt.');
  } else {
    await sql`
      INSERT INTO role_runs (role_id, role_type, summary_json)
      VALUES (
        ${GBP_CREDIT_DEPARTMENT_ID},
        'department',
        ${JSON.stringify({
          event: 'gbp_presence_posted',
          credit: GBP_CREDIT_DEPARTMENT_ID,
          secondary_hat: GBP_SECONDARY_HAT,
          inserted: result.inserted,
          periods: result.months.map((month) => ({
            period: month.period,
            gbp_profile_views: month.profileViews,
            gbp_interactions: month.interactions,
          })),
          ruling: '2026-08-09 KEEP businessprofile-noreply; hat Dept4, secondary Dept6',
        })}::jsonb
      )
    `;
    console.log(`Credit receipt: role_runs ${GBP_CREDIT_DEPARTMENT_ID}`);
    console.log(`Inserted: ${result.inserted.join(', ')}`);
  }

  if ('end' in sql && typeof sql.end === 'function') {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
