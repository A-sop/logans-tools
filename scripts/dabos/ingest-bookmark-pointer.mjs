#!/usr/bin/env node
/**
 * Stub bookmark capture → POST /api/dabos/ingest (mouth=bookmark).
 * Full Chrome export harness is Dept11 I4; this wires cycle_stage + mouth_kind on the shared ingest path.
 *
 * Usage:
 *   node scripts/dabos/ingest-bookmark-pointer.mjs --url "https://example.com" --title "Example"
 * Env: DABOS_INGEST_URL, TIER0_BEARER or DABOS_TIER0_TOKEN (same as telegram capture)
 */
const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}

const url = flag('--url');
const title = flag('--title') || 'Bookmark';
const externalId = flag('--id') || `bookmark:${Buffer.from(url || '').toString('base64url').slice(0, 40)}`;

if (!url) {
  console.error('Usage: ingest-bookmark-pointer.mjs --url <https://...> [--title t] [--id ext]');
  process.exit(1);
}

const ingestUrl = process.env.DABOS_INGEST_URL || 'https://dabos.logans.tools/api/dabos/ingest';
const token =
  process.env.TIER0_BEARER || process.env.DABOS_TIER0_TOKEN || process.env.DABOS_INGEST_TOKEN;
if (!token) {
  console.error('Set TIER0_BEARER or DABOS_TIER0_TOKEN');
  process.exit(1);
}

const body = {
  mouth: 'bookmark',
  external_id: externalId,
  text: title,
  urls: [url],
  mouth_kind: 'bookmark',
  cycle_stage: 0,
};

const res = await fetch(ingestUrl, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});

const text = await res.text();
if (!res.ok) {
  console.error(res.status, text);
  process.exit(1);
}
console.log(text);
