#!/usr/bin/env npx tsx
/**
 * Screenshot a page and save to public/.
 * Run: npm run screenshot:landing
 *
 * Env / args:
 *   LANDING_PAGE_URL — page to capture (default: https://cm.logans.tools)
 *   SCREENSHOT_OUTPUT — filename under public/ (default: cm-landing.png)
 *   argv[2] — URL override
 *   argv[3] — output filename override
 *
 * Expat build log: LANDING_PAGE_URL=http://localhost:3000/expat SCREENSHOT_OUTPUT=expat-hackathon.png npm run screenshot:landing
 */
import fs from 'fs';
import path from 'path';

const outputFile =
  process.env.SCREENSHOT_OUTPUT || process.argv[3] || 'cm-landing.png';
const OUTPUT_PATH = path.join(process.cwd(), 'public', outputFile);

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
