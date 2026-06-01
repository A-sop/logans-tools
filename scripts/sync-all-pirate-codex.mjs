/**
 * Run full Pirate Codex sync (Grow + Build) into DABOS.
 * Requires playwright in logans-tools: npm install
 *
 *   node scripts/sync-all-pirate-codex.mjs [--force] [--cdp http://127.0.0.1:9222]
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const dabosScripts = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'DABOS', 'scripts');
const nodeArgs = process.argv.slice(2);

const child = spawn(process.execPath, [path.join(dabosScripts, 'sync-all-pirate-codex.mjs'), ...nodeArgs], {
  stdio: 'inherit',
  cwd: path.join(dabosScripts, '..'),
});

child.on('close', (code) => process.exit(code ?? 0));
