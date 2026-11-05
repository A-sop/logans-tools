/**
 * RR-010 step 1: watchman runner, one tick (ln02 systemd user timer, every 5 minutes).
 *
 * Run: npm run --silent dabos:watchman [-- --dry-run]
 * Unit + timer: scripts/dabos/ln02/dabos-watchman.{service,timer}
 * Install (dry run unless --apply): scripts/dabos/ln02/install-watchman.sh
 *
 * Environment (loaded by systemd from %h/.config/dabos/watchman.env, mode 600, placed by Logan;
 * this script never reads .env.local or any file for secrets and never prints a value):
 *   WATCHMAN_DATABASE_URL         Neon connection string for role dabos_watchman
 *   WATCHMAN_AGENTS               comma list of agent ids with a webhook routine, e.g. ldw,div1,...,div7
 *   WATCHMAN_HOOK_<AGENT>_URL     that agent's routine webhook URL (one pair per listed agent)
 *   WATCHMAN_HOOK_<AGENT>_KEY     that routine's sender key
 * Options (not secret):
 *   WATCHMAN_DRY_RUN=1            same as --dry-run: decide and print, write nothing, POST nothing
 *   WATCHMAN_KEY_HEADER           header for the key (default Authorization)
 *   WATCHMAN_KEY_SCHEME           prefix before the key (default Bearer; empty for the bare key)
 *   WATCHMAN_STATE_DIR            default ~/.local/state/dabos-watchman
 *
 * Exit code 1 on any failure, so the unit shows failed in the ln02 status digest. Failures also go
 * to div4's inbox (owner post Dept12 Production, Div4). Only a full clean non-dry tick clears the
 * failure state file.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

import { createDabosSql } from '../../src/lib/dabos/dabos-connection';
import {
  FAILURE_OWNER,
  errorText,
  nextFailureState,
  parseConfig,
  redact,
  runTick,
  type FailureState,
  type FetchLike,
} from '../../src/lib/dabos/watchman';

function readState(file: string): FailureState {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as FailureState;
  } catch {
    return { open: [], lastCleanFullRun: null };
  }
}

function writeState(file: string, state: FailureState) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o750 });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n', { mode: 0o640 });
  fs.renameSync(tmp, file);
}

async function main() {
  const now = new Date();
  const dryRun = process.argv.includes('--dry-run') || process.env.WATCHMAN_DRY_RUN === '1';
  const dbUrl = process.env.WATCHMAN_DATABASE_URL?.trim();
  const stateFile = path.join(
    process.env.WATCHMAN_STATE_DIR?.trim() || path.join(os.homedir(), '.local', 'state', 'dabos-watchman'),
    'state.json'
  );
  const config = parseConfig(process.env);
  const log = (line: string) => console.log(redact(line, config.hooks));

  const prev = readState(stateFile);
  const kinds: string[] = [];
  let complete = false;
  if (!dbUrl) {
    console.error('WATCHMAN_DATABASE_URL is not set');
    kinds.push('config_database_url');
  }
  for (const e of config.errors) console.error(`config: ${e}`);
  if (config.errors.length && !dryRun) kinds.push('config_hooks');

  if (dbUrl) {
    try {
      const res = await runTick({
        sql: createDabosSql(dbUrl),
        fetchFn: fetch as unknown as FetchLike,
        config,
        now,
        dryRun,
        log,
      });
      if (dryRun) for (const f of res.failures) log(`[dry run] would file failure kind=${f.kind}`);
      else kinds.push(...res.failures.map((f) => f.kind));
      complete = true;
    } catch (e) {
      console.error(`tick failed (${redact(errorText(e), config.hooks)})`);
      kinds.push('tick_error');
    }
  }

  const state = nextFailureState(prev, { now, dryRun, complete, failureKinds: kinds });
  if (!dryRun) {
    try {
      writeState(stateFile, state);
    } catch (e) {
      console.error(`state write failed (${errorText(e)})`);
    }
  }
  if (state.open.length) {
    console.error(`open failures (owner: ${FAILURE_OWNER}): ${state.open.map((f) => f.kind).join(', ')}`);
  }
  if (kinds.length) process.exit(1);
}

main().catch((e) => {
  console.error(`watchman crashed (${errorText(e).replace(/https?:\/\/\S+|postgres(ql)?:\/\/\S+/g, '[url]')})`);
  process.exit(1);
});
