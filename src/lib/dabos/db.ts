import 'server-only';

import { neon } from '@neondatabase/serverless';
import postgres from 'postgres';

function connectionString(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error('Missing required environment variable: DATABASE_URL');
  }
  return url;
}

function isNeonUrl(url: string): boolean {
  try {
    const host = new URL(url.replace(/^postgresql:/, 'http:')).hostname;
    return host.includes('neon.tech');
  } catch {
    return false;
  }
}

const globalForDabos = globalThis as typeof globalThis & {
  __dabosPg?: ReturnType<typeof postgres>;
};

function poolMax(): number {
  const fromEnv = process.env.DABOS_PG_POOL_MAX?.trim();
  if (fromEnv) {
    const n = Number(fromEnv);
    if (Number.isFinite(n) && n >= 1) return Math.floor(n);
  }
  // Homelab Postgres (ln02): keep tiny — dev HMR must not exhaust max_connections.
  return 2;
}

function createPgClient(url: string) {
  return postgres(url, {
    max: poolMax(),
    idle_timeout: 20,
    max_lifetime: 60 * 10,
    connect_timeout: 10,
  });
}

export function hasDabosDb(): boolean {
  return !!process.env.DATABASE_URL?.trim();
}

export function getDabosSql() {
  const url = connectionString();
  if (isNeonUrl(url)) {
    return neon(url);
  }
  if (!globalForDabos.__dabosPg) {
    globalForDabos.__dabosPg = createPgClient(url);
  }
  return globalForDabos.__dabosPg;
}

export type Sql = ReturnType<typeof getDabosSql>;
