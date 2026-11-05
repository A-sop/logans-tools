/**
 * Live week stats from Neon (skips superseded). Communicator / Div1 / register archive.
 *
 *   npm run dabos:week-stats-live
 *   npm run dabos:week-stats-live -- --week=2026-W45
 *   npm run dabos:week-stats-live -- --week=2026-W45 --markdown --out=C:\path\2026-W45.md
 */
import fs from 'fs';
import path from 'path';
import { createDabosSql } from '../../src/lib/dabos/dabos-connection';
import {
  formatWeekStatsRegisterMarkdown,
  readWeekStatsLive,
} from '../../src/lib/dabos/week-stats-live';
import { requireDatabaseUrl } from './load-env';

function argValue(name: string): string | undefined {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  if (hit === `--${name}`) return '';
  return hit.slice(`--${name}=`.length);
}

function hasFlag(name: string): boolean {
  return process.argv.some((a) => a === `--${name}` || a.startsWith(`--${name}=`));
}

async function main() {
  const week = argValue('week') || undefined;
  const markdown = hasFlag('markdown');
  const out = argValue('out');

  const sql = createDabosSql(requireDatabaseUrl());
  const snap = await readWeekStatsLive(sql, { week: week || undefined });

  if (markdown) {
    const body = formatWeekStatsRegisterMarkdown(snap);
    if (out) {
      const abs = path.resolve(out);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, body, 'utf8');
      console.error(`wrote ${abs}`);
    }
    process.stdout.write(body);
  } else {
    console.log(JSON.stringify(snap, null, 2));
  }

  if ('end' in sql && typeof sql.end === 'function') {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
