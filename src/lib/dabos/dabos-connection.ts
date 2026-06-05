import { neon } from '@neondatabase/serverless';
import postgres from 'postgres';

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
