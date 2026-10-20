/**
 * Print HWW_ALLOWED_CLERK_USER_IDS for Logan (id only; no secrets).
 * Delete after one-shot use if preferred — kept for re-resolve.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadEnvLocal } from '../dabos/load-env';

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=(.*)$/);
    if (!m) continue;
    const val = m[2].trim().replace(/^["']|["']$/g, '');
    if (!process.env[m[1]] || process.env[m[1]]!.trim() === '') {
      process.env[m[1]] = val;
    }
  }
}

async function main() {
  loadEnvLocal();
  loadEnvFile(path.join(process.cwd(), '.env.vercel.hww.tmp'));
  const key = process.env.CLERK_SECRET_KEY?.trim();
  if (!key || key === '[SENSITIVE]') {
    console.error('MISSING CLERK_SECRET_KEY');
    process.exit(1);
  }
  const email = (process.env.DABOS_ALLOWED_EMAILS || 'logan.d.williams@gmail.com')
    .split(',')[0]!
    .trim()
    .toLowerCase();
  const url =
    'https://api.clerk.com/v1/users?email_address=' + encodeURIComponent(email) + '&limit=5';
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + key } });
  if (!res.ok) {
    console.error('CLERK_HTTP', res.status);
    process.exit(1);
  }
  const users = (await res.json()) as { id: string }[];
  const ids = (Array.isArray(users) ? users : []).map((u) => u.id);
  console.log('EMAIL_MATCH_COUNT', ids.length);
  console.log('HWW_ALLOWED_CLERK_USER_IDS=' + ids.join(','));
}

main();
