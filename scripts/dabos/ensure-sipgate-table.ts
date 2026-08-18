#!/usr/bin/env npx tsx
import fs from 'fs';
import path from 'path';
import { neon } from '@neondatabase/serverless';

function loadEnv(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = trimmed.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
}

if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED && !process.env.POSTGRES_URL) {
  loadEnv(path.join(process.cwd(), '.env.local'));
}
const url = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL;
if (!url) {
  console.error('NO_DATABASE_URL');
  process.exit(1);
}

const host = new URL(url.replace(/^postgresql:/, 'http:')).hostname;
console.log('db_host', host);
const sql = neon(url);

async function main() {
  const before = await sql`SELECT to_regclass('public.sipgate_assist_events') AS t`;
  console.log('table_before', before[0]?.t);
  await sql`CREATE TABLE IF NOT EXISTS sipgate_assist_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    consumed_at TIMESTAMPTZ,
    call_id TEXT,
    direction TEXT,
    remote_number TEXT,
    local_number TEXT,
    channel_name TEXT,
    started_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    headline TEXT,
    summary TEXT,
    action_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    has_transcript BOOLEAN NOT NULL DEFAULT FALSE,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_ip TEXT
  )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_sipgate_assist_events_call_id
    ON sipgate_assist_events (call_id)
    WHERE call_id IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sipgate_assist_events_pending
    ON sipgate_assist_events (received_at DESC)
    WHERE consumed_at IS NULL`;
  const after = await sql`SELECT to_regclass('public.sipgate_assist_events') AS t`;
  const count = await sql`SELECT COUNT(*)::int AS c FROM sipgate_assist_events`;
  console.log('table_after', after[0]?.t, 'rows', count[0]?.c);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
