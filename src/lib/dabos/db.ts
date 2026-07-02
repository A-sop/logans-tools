import 'server-only';

import { createDabosSql, isNeonUrl, resolveDabosDatabaseUrl } from '@/lib/dabos/dabos-connection';
import postgres from 'postgres';

function connectionString(): string {
  const url = resolveDabosDatabaseUrl();
  if (!url) {
    throw new Error('Missing required environment variable: DATABASE_URL (or DATABASE_URL_UNPOOLED)');
  }
  return url;
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
  return !!resolveDabosDatabaseUrl();
}

export function getDabosSql() {
  const url = connectionString();
  if (isNeonUrl(url)) {
    return createDabosSql(url);
  }
  if (!globalForDabos.__dabosPg) {
    globalForDabos.__dabosPg = createPgClient(url);
  }
  return globalForDabos.__dabosPg;
}

export type Sql = ReturnType<typeof getDabosSql>;
