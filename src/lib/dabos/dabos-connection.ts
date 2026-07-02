import { neon } from '@neondatabase/serverless';
import postgres from 'postgres';

/** Neon projects often set DATABASE_URL_UNPOOLED when DATABASE_URL is empty in .env.local. */
export function resolveDabosDatabaseUrl(): string | undefined {
  const primary = process.env.DATABASE_URL?.trim();
  if (primary) return primary;
  return process.env.DATABASE_URL_UNPOOLED?.trim() || undefined;
}

export function isNeonUrl(url: string): boolean {
  try {
    const host = new URL(url.replace(/^postgresql:/, 'http:')).hostname;
    return host.includes('neon.tech');
  } catch {
    return false;
  }
}

export function createDabosSql(url: string) {
  if (isNeonUrl(url)) {
    return neon(url);
  }
  return postgres(url, { max: 1, idle_timeout: 20, connect_timeout: 10 });
}

export type DabosSql = ReturnType<typeof createDabosSql>;
