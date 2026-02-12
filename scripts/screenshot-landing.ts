#!/usr/bin/env npx tsx
/**
 * Screenshot the Concierge landing page and save to public/cm-landing.png.
 * Run: npm run screenshot:landing
 *
 * Set LANDING_PAGE_URL in .env.local (default: https://cm.logans.tools)
 * For local: LANDING_PAGE_URL=http://localhost:3000
 */
import fs from 'fs';
import path from 'path';

const OUTPUT_PATH = path.join(process.cwd(), 'public', 'cm-landing.png');

// Load .env.local
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
  const url =
    process.env.LANDING_PAGE_URL ||
    process.argv[2] ||
    'https://cm.logans.tools';

  console.log(`Screenshotting ${url}...`);
  console.log(`Output: ${OUTPUT_PATH}`);

  const { chromium } = await import('playwright');

  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.setViewportSize({ width: 1200, height: 675 });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.screenshot({
    path: OUTPUT_PATH,
    fullPage: false,
  });

  await browser.close();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
