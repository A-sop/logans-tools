/**
 * Ad Council Neon CLI (dry-run default; --apply writes).
 *
 * Open / ensure session:
 *   npx tsx scripts/dabos/ad-council.ts ensure-session --week=2026-W45 --purpose=week_close --by=div7-chair
 *
 * Secretary recommend:
 *   npx tsx scripts/dabos/ad-council.ts recommend --week=2026-W45 --div=Div2 --condition=Confusion --subject="hold Confusion" --by=div2-sec --apply
 *
 * Div7 seal (requires ≥1 recommend):
 *   npx tsx scripts/dabos/ad-council.ts council-decide --week=2026-W45 --subject="W45 conditions hold" --by=div7-chair --apply
 *
 * List:
 *   npx tsx scripts/dabos/ad-council.ts list --week=2026-W45 --purpose=week_close
 */
import { createDabosSql } from '../../src/lib/dabos/dabos-connection';
import {
  ensureAdCouncilSession,
  insertAdCouncilDecision,
  listLiveDecisions,
  sessionHasCouncilDecide,
  type AdCouncilPurpose,
} from '../../src/lib/dabos/ad-council';
import { requireDatabaseUrl } from './load-env';

function flag(name: string): string | undefined {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  if (hit === `--${name}`) return '';
  return hit.slice(`--${name}=`.length);
}

function must(name: string): string {
  const v = flag(name);
  if (!v) throw new Error(`--${name}= required`);
  return v;
}

async function main() {
  const cmd = process.argv[2];
  if (!cmd || cmd.startsWith('--')) {
    throw new Error('Usage: ad-council <ensure-session|recommend|council-decide|list> …');
  }
  const apply = process.argv.includes('--apply');
  const week = flag('week');
  const purpose = (flag('purpose') ?? 'week_close') as AdCouncilPurpose;
  const by = flag('by') ?? 'cli';

  const sql = createDabosSql(requireDatabaseUrl());

  if (cmd === 'ensure-session' || cmd === 'recommend' || cmd === 'council-decide' || cmd === 'list') {
    console.log(`${apply || cmd === 'list' ? '' : 'DRY RUN — pass --apply to write\n'}`.trimEnd());
  }

  if (cmd === 'ensure-session') {
    if (!apply) {
      console.log(`Would ensure session week=${week ?? '(closed)'} purpose=${purpose}`);
      return;
    }
    const s = await ensureAdCouncilSession(sql, {
      week,
      purpose,
      recordedBy: by,
    });
    console.log(JSON.stringify(s, null, 2));
    return;
  }

  if (cmd === 'list') {
    const s = await ensureAdCouncilSession(sql, { week, purpose, recordedBy: by });
    const rows = await listLiveDecisions(sql, s.id);
    const sealed = await sessionHasCouncilDecide(sql, s.id);
    console.log(JSON.stringify({ session: s, sealed, decisions: rows }, null, 2));
    return;
  }

  if (cmd === 'recommend') {
    const div = must('div');
    const condition = must('condition');
    const subject = flag('subject') ?? `hold ${condition} ${div}`;
    if (!apply) {
      console.log(`Would recommend ${div} -> ${condition}: ${subject}`);
      return;
    }
    const s = await ensureAdCouncilSession(sql, { week, purpose, recordedBy: by });
    const row = await insertAdCouncilDecision(sql, {
      sessionId: s.id,
      actorKind: 'division_secretary',
      actorId: div,
      decisionKind: 'condition_recommend',
      subject,
      entityType: 'division',
      entityId: div,
      recommendedCondition: condition,
      recordedBy: by,
    });
    console.log(JSON.stringify({ session: s, decision: row }, null, 2));
    return;
  }

  if (cmd === 'council-decide') {
    const subject = must('subject');
    if (!apply) {
      console.log(`Would council-decide: ${subject}`);
      return;
    }
    const s = await ensureAdCouncilSession(sql, { week, purpose, recordedBy: by });
    const row = await insertAdCouncilDecision(sql, {
      sessionId: s.id,
      actorKind: 'div7_chair',
      actorId: 'Div7',
      decisionKind: 'council_decide',
      subject,
      recordedBy: by,
    });
    console.log(JSON.stringify({ session: s, decision: row }, null, 2));
    return;
  }

  throw new Error(`Unknown command: ${cmd}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    /* connection may auto-close */
  });
