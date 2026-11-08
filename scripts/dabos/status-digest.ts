/**
 * RR-010 step 3: build one Div1–7 status digest and leave it where LDW reads it.
 *
 * Run (ln02, via systemd): npm run dabos:status-digest
 * Unit + timer: scripts/dabos/ln02/dabos-status-digest.{service,timer}
 * Install (dry run unless --apply): scripts/dabos/ln02/install-status-digest.sh
 *
 * Environment (loaded by systemd from %h/.config/dabos/status-digest.env; this script never reads
 * .env.local or any file for secrets, and never prints their values):
 *   DABOS_DIGEST_DATABASE_URL   Neon connection string for the digest role (read + INSERT role_runs)
 *   DABOS_DIGEST_GITHUB_TOKEN   fine-grained PAT, read-only Pull requests + Metadata on the two repos
 * Options (not secret):
 *   DABOS_DIGEST_OUT_DIR        default ~/.local/state/dabos-status-digest
 *   DABOS_DIGEST_DRY_RUN=1      print the markdown; write no file and no row
 *   DABOS_DIGEST_SYSTEMD        user (default on Linux) | off
 *   DABOS_DIGEST_UNIT_FILTER    optional regex on timer/unit names, e.g. ^(dabos|chrome-guard)
 *   DABOS_DIGEST_HOST           default os.hostname()
 *   DABOS_DIGEST_CHECKOUT_SYNC_DIR  default ~/.local/state/dabos (reads only checkout-sync.FAIL and
 *                               checkout-sync.status.json from logans-tools #59's sync)
 * Telegram tip (opt-in; missing tip env = silent pull-only, not a failure — ruling 2026-11-08):
 *   DABOS_DIGEST_TELEGRAM_TIP=1     enable tip send after a successful file or Neon write
 *   DABOS_DIGEST_TELEGRAM_BOT_TOKEN Bot API token (secret)
 *   DABOS_DIGEST_TELEGRAM_CHAT_ID   chat id (secret)
 *   DABOS_DIGEST_PULL_URL           optional; default https://dabos.logans.tools/digest
 */
import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { createDabosSql } from '../../src/lib/dabos/dabos-connection';
import {
  buildDigest,
  buildTelegramTip,
  collectDigestInput,
  errorText,
  insertDigestRow,
  sendTelegramTip,
  type FetchLike,
  type ReadText,
  type RunCommand,
} from '../../src/lib/dabos/status-digest';

const readText: ReadText = async (p) => {
  try {
    return await fs.promises.readFile(p, 'utf8');
  } catch (e) {
    if ((e as { code?: string }).code === 'ENOENT') return null;
    throw e;
  }
};

const runCommand: RunCommand = (cmd, args) =>
  new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 20_000, maxBuffer: 2 * 1024 * 1024 }, (err, stdout) => {
      if (err)
        reject(
          new Error(
            `${cmd} ${args.slice(0, 3).join(' ')} failed (${(err as { code?: string | number }).code ?? 'error'})`
          )
        );
      else resolve(stdout);
    });
  });

function writeAtomic(file: string, content: string) {
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, content, { mode: 0o640 });
  fs.renameSync(tmp, file);
}

async function main() {
  const now = new Date();
  const dbUrl = process.env.DABOS_DIGEST_DATABASE_URL?.trim() || null;
  const token = process.env.DABOS_DIGEST_GITHUB_TOKEN?.trim() || null;
  const dryRun = process.env.DABOS_DIGEST_DRY_RUN === '1';
  const systemdMode =
    process.env.DABOS_DIGEST_SYSTEMD ?? (process.platform === 'linux' ? 'user' : 'off');
  const outDir =
    process.env.DABOS_DIGEST_OUT_DIR?.trim() ||
    path.join(os.homedir(), '.local', 'state', 'dabos-status-digest');
  const filter = process.env.DABOS_DIGEST_UNIT_FILTER?.trim();
  const host = process.env.DABOS_DIGEST_HOST?.trim() || os.hostname();
  const checkoutSyncDir =
    process.env.DABOS_DIGEST_CHECKOUT_SYNC_DIR?.trim() ||
    path.join(os.homedir(), '.local', 'state', 'dabos');

  const sql = dbUrl ? createDabosSql(dbUrl) : null;
  const input = await collectDigestInput({
    now,
    host,
    sql,
    github: token ? { fetchFn: fetch as unknown as FetchLike, token } : null,
    run: systemdMode === 'user' ? runCommand : null,
    unitFilter: filter ? new RegExp(filter) : undefined,
    checkoutSync: { dir: checkoutSyncDir, readText },
  });
  const digest = buildDigest(input);

  if (dryRun) {
    process.stdout.write(digest.markdown);
    console.log(
      `\n[dry run] no file, no role_runs row. Source errors: ${input.sourceErrors.length}`
    );
    return;
  }

  let wroteFile = false;
  let wroteRow = false;
  try {
    fs.mkdirSync(outDir, { recursive: true, mode: 0o750 });
    writeAtomic(path.join(outDir, 'latest.md'), digest.markdown);
    writeAtomic(path.join(outDir, 'latest.json'), JSON.stringify(digest.json, null, 2) + '\n');
    wroteFile = true;
  } catch (e) {
    console.error(`file write failed: ${errorText(e)}`);
  }
  if (sql) {
    try {
      await insertDigestRow(sql, digest);
      wroteRow = true;
    } catch (e) {
      console.error(`role_runs insert failed: ${errorText(e)}`);
    }
  }
  let tipStatus = 'skipped';
  if (wroteFile || wroteRow) {
    const tipEnabled = process.env.DABOS_DIGEST_TELEGRAM_TIP === '1';
    const tip = buildTelegramTip(digest, {
      pullUrl: process.env.DABOS_DIGEST_PULL_URL?.trim() || undefined,
    });
    const tipResult = await sendTelegramTip({
      text: tip,
      enabled: tipEnabled,
      botToken: process.env.DABOS_DIGEST_TELEGRAM_BOT_TOKEN,
      chatId: process.env.DABOS_DIGEST_TELEGRAM_CHAT_ID,
      fetchFn: fetch as unknown as FetchLike,
    });
    if (tipResult.sent) tipStatus = 'ok';
    else if (tipResult.reason === 'disabled') tipStatus = 'off';
    else if (tipResult.reason === 'missing_env') tipStatus = 'missing_env';
    else if (tipResult.reason === 'empty') tipStatus = 'empty';
    else if (tipResult.reason === 'http') tipStatus = `http_${tipResult.status}`;
    else tipStatus = 'failed';
  }

  console.log(
    `status digest ${now.toISOString()}: file=${wroteFile ? 'ok' : 'FAILED'} row=${wroteRow ? 'ok' : sql ? 'FAILED' : 'skipped'} ` +
      `tip=${tipStatus} needsLogan=${digest.json.needsLogan.length} needsDept13=${digest.json.needsDept13.length} ` +
      `alerts=${digest.json.machineAlerts.length} sourceErrors=${input.sourceErrors.length}`
  );
  const closable = sql as unknown as { end?: () => Promise<void> } | null;
  if (closable?.end) await closable.end();
  if (!wroteFile && !wroteRow) process.exit(1);
}

main().catch((e) => {
  console.error(`status digest crashed: ${errorText(e)}`);
  process.exit(1);
});
