#!/usr/bin/env npx tsx
/**
 * Test Ahrefs API connectivity.
 * Run: npx tsx scripts/ahrefs-test.ts
 * Requires: AHREFS_API_KEY in .env.local
 */
import fs from 'fs';
import path from 'path';

// Load .env.local before importing ahrefs
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach((line) => {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=(.*)$/);
      if (m) {
        const val = m[2].trim();
        process.env[m[1]] = val.replace(/^["']|["']$/g, '');
      }
    });
}

async function main() {
  const key = process.env.AHREFS_API_KEY;
  if (!key?.trim()) {
    console.error('❌ AHREFS_API_KEY not set in .env.local');
    console.error('   Add it from https://app.ahrefs.com/account/api-keys');
    process.exit(1);
  }

  console.log('Testing Ahrefs API...\n');

  // Dynamic import so env is loaded first
  const { getSubscriptionInfo, getKeywordMetrics } = await import(
    '../src/lib/ahrefs'
  );

  try {
    console.log('1. Subscription info (no API units consumed)...');
    const sub = await getSubscriptionInfo();
    console.log('   ✓', JSON.stringify(sub, null, 2));
  } catch (e) {
    console.error('   ✗', e instanceof Error ? e.message : e);
    console.error('\n   Tip: If 404 or connection error, the API base URL may differ.');
    console.error('   Open any Ahrefs report → click API button → copy the base URL.');
    console.error('   Set AHREFS_API_BASE in .env.local if needed.\n');
  }

  try {
    console.log('\n2. Keyword metrics for "ahrefs.com" (free test target)...');
    const metrics = await getKeywordMetrics('ahrefs.com');
    console.log('   ✓', JSON.stringify(metrics, null, 2));
  } catch (e) {
    console.error('   ✗', e instanceof Error ? e.message : e);
    console.error('\n   Non-Enterprise: only "ahrefs.com" or "wordcount.com" work as free targets.');
  }

  console.log('\nDone.');
}

main();
