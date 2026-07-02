import fs from 'fs';
import path from 'path';

import { resolveDabosDatabaseUrl } from '../../src/lib/dabos/dabos-connection';

export function loadEnvLocal(): void {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8').replace(/^\uFEFF/, '');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=(.*)$/);
    if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

export function requireDatabaseUrl(): string {
  loadEnvLocal();
  const url = resolveDabosDatabaseUrl();
  if (!url) {
    console.error('DATABASE_URL (or DATABASE_URL_UNPOOLED) is required in .env.local');
    process.exit(1);
  }
  return url;
}
