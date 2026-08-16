#!/usr/bin/env node
/**
 * Check which env keys from .env.example are set in .env.local.
 * Only outputs key names and SET/MISSING - never prints values.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const envLocalPath = path.join(root, '.env.local');

const required = [
  'OPENAI_API_KEY',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
];
const requiredDbAnyOf = ['DATABASE_URL', 'DATABASE_URL_UNPOOLED'];
const optional = [
  'N8N_FEEDBACK_WEBHOOK_URL',
  'N8N_WEBHOOK_SECRET',
  'NEXT_PUBLIC_CLERK_SIGN_IN_URL',
  'NEXT_PUBLIC_CLERK_SIGN_UP_URL',
  'NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL',
  'NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL',
  'AHREFS_API_KEY',
];

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const out = {};
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const local = parseEnv(envLocalPath);
const hasRealValue = (v) =>
  typeof v === 'string' &&
  v.length > 0 &&
  !/^your_|^your-|^$/.test(v);

console.log('=== .env.local key check ===\n');
if (Object.keys(local).length === 0) {
  console.log('.env.local not found or empty. Copy .env.example to .env.local and fill in keys.\n');
  process.exit(1);
}

console.log('Required (app auth + OpenAI + Neon):');
for (const k of required) {
  const v = local[k];
  console.log('  ' + k + ': ' + (hasRealValue(v) ? 'SET' : 'MISSING or placeholder'));
}
const dbSet = requiredDbAnyOf.some((k) => hasRealValue(local[k]));
console.log(
  '  DATABASE_URL or DATABASE_URL_UNPOOLED: ' + (dbSet ? 'SET' : 'MISSING or placeholder')
);

console.log('\nOptional (n8n feedback flow — lessons 5.4, 5.5):');
for (const k of optional) {
  const v = local[k];
  const set = hasRealValue(v);
  if (k.startsWith('NEXT_PUBLIC_CLERK_') && (k.includes('URL') || k.includes('REDIRECT'))) {
    console.log('  ' + k + ': ' + (v && v.length ? 'SET' : 'not set (defaults in .env.example)'));
  } else {
    console.log('  ' + k + ': ' + (set ? 'SET' : 'MISSING or empty'));
  }
}

const missingRequired = required.filter((k) => !hasRealValue(local[k]));
if (!dbSet) missingRequired.push('DATABASE_URL|DATABASE_URL_UNPOOLED');
if (missingRequired.length > 0) {
  console.log('\n⚠  Missing required keys: ' + missingRequired.join(', '));
  process.exit(1);
}
console.log('\n✓ All required keys are set.');
process.exit(0);
