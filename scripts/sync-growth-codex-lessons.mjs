/**
 * Sync Growth Codex lesson bodies from pirateskills.com (requires logged-in session).
 *
 * Usage (pick one):
 *   A) Chrome remote debugging (recommended — stay logged in in your normal Chrome):
 *      Close other automation, then start Chrome:
 *        "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
 *      Sign in to pirateskills.com, then:
 *        node scripts/sync-growth-codex-lessons.mjs --cdp http://127.0.0.1:9222
 *
 *   B) Persistent profile (Chrome must be fully quit):
 *        node scripts/sync-growth-codex-lessons.mjs --profile
 *
 *   C) Headed manual login once:
 *        node scripts/sync-growth-codex-lessons.mjs --login
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_ROOT = path.join(__dirname, '..', '..', 'DABOS', 'docs', 'pirate-codex', 'grow');
const SYNCED_AT = new Date().toISOString().slice(0, 10);

const LESSONS = [
  // 1 Growth Roadmap
  {
    id: 'grow.growth-roadmap.1.1',
    pillar: '1 Growth Roadmap',
    file: 'growth-roadmap/1.1-overview.md',
    url: 'https://pirateskills.com/grow/codex/growth-roadmap/overview',
    title: 'Overview — Building a solid growth marketing strategy',
  },
  {
    id: 'grow.growth-roadmap.1.2',
    pillar: '1 Growth Roadmap',
    file: 'growth-roadmap/1.2-where-we-aarrr.md',
    url: 'https://pirateskills.com/grow/codex/growth-roadmap/where-we-aarrr',
    title: 'Where we AARRR — Honest analysis of current situation',
  },
  {
    id: 'grow.growth-roadmap.1.3',
    pillar: '1 Growth Roadmap',
    file: 'growth-roadmap/1.3-where-the-treasure-lies.md',
    url: 'https://pirateskills.com/grow/codex/growth-roadmap/where-the-treasure-lies',
    title: 'Where the treasure lies — Challenging growth goals',
  },
  {
    id: 'grow.growth-roadmap.1.4',
    pillar: '1 Growth Roadmap',
    file: 'growth-roadmap/1.4-how-we-get-there.md',
    url: 'https://pirateskills.com/grow/codex/growth-roadmap/how-we-get-there',
    title: 'How we get there — Projects to achieve goals',
  },
  {
    id: 'grow.growth-roadmap.1.5',
    pillar: '1 Growth Roadmap',
    file: 'growth-roadmap/1.5-who-is-doing-what.md',
    url: 'https://pirateskills.com/grow/codex/growth-roadmap/who-is-doing-what',
    title: 'Who is doing what — Team responsibilities and resources',
  },
  {
    id: 'grow.growth-roadmap.1.6',
    pillar: '1 Growth Roadmap',
    file: 'growth-roadmap/1.6-summary.md',
    url: 'https://pirateskills.com/grow/codex/growth-roadmap/summary',
    title: 'Summary — Working with your growth roadmap',
  },
  // 2 Content & Story
  {
    id: 'grow.content-story.2.1',
    pillar: '2 Content & Story',
    file: 'content-story/2.1-overview.md',
    url: 'https://pirateskills.com/grow/codex/content-story/overview',
    title: 'Overview — Crafting a resonating story and publishing great content',
  },
  {
    id: 'grow.content-story.2.2',
    pillar: '2 Content & Story',
    file: 'content-story/2.2-why-we-do-this.md',
    url: 'https://pirateskills.com/grow/codex/content-story/why-we-do-this',
    title: 'Why we do this — Story that resonates with core audience',
  },
  {
    id: 'grow.content-story.2.3',
    pillar: '2 Content & Story',
    file: 'content-story/2.3-what-we-talk-about.md',
    url: 'https://pirateskills.com/grow/codex/content-story/what-we-talk-about',
    title: 'What we talk about — Topics that position you as go-to solver',
  },
  {
    id: 'grow.content-story.2.4',
    pillar: '2 Content & Story',
    file: 'content-story/2.4-how-we-talk-about-it.md',
    url: 'https://pirateskills.com/grow/codex/content-story/how-we-talk-about-it',
    title: 'How we talk about it — Packaging and delivering message in style',
  },
  {
    id: 'grow.content-story.2.5',
    pillar: '2 Content & Story',
    file: 'content-story/2.5-when-we-talk-about-it.md',
    url: 'https://pirateskills.com/grow/codex/content-story/when-we-talk-about-it',
    title: 'When we talk about it — Make audience go AARRR every month',
  },
  {
    id: 'grow.content-story.2.6',
    pillar: '2 Content & Story',
    file: 'content-story/2.6-summary.md',
    url: 'https://pirateskills.com/grow/codex/content-story/summary',
    title: 'Summary — Working with content and story strategy',
  },
  // 3 Funnel Building
  {
    id: 'grow.funnel-building.3.1',
    pillar: '3 Funnel Building',
    file: 'funnel-building/3.1-overview.md',
    url: 'https://pirateskills.com/grow/codex/funnel-building/overview',
    title: 'Overview — Build a value-driven marketing funnel',
  },
  {
    id: 'grow.funnel-building.3.2',
    pillar: '3 Funnel Building',
    file: 'funnel-building/3.2-funnel-overview.md',
    url: 'https://pirateskills.com/grow/codex/funnel-building/funnel-overview',
    title: 'Funnel overview — Customer journey: trust and revenue',
  },
  {
    id: 'grow.funnel-building.3.3',
    pillar: '3 Funnel Building',
    file: 'funnel-building/3.3-landing-pages.md',
    url: 'https://pirateskills.com/grow/codex/funnel-building/landing-pages',
    title: 'Landing pages — Websites that convert leads and sales',
  },
  {
    id: 'grow.funnel-building.3.4',
    pillar: '3 Funnel Building',
    file: 'funnel-building/3.4-messages.md',
    url: 'https://pirateskills.com/grow/codex/funnel-building/messages',
    title: 'Messages — Inbound and outbound messages and emails',
  },
  {
    id: 'grow.funnel-building.3.5',
    pillar: '3 Funnel Building',
    file: 'funnel-building/3.5-crm-workflows.md',
    url: 'https://pirateskills.com/grow/codex/funnel-building/crm-workflows',
    title: 'CRM workflows — One source of truth for the journey',
  },
  {
    id: 'grow.funnel-building.3.6',
    pillar: '3 Funnel Building',
    file: 'funnel-building/3.6-summary.md',
    url: 'https://pirateskills.com/grow/codex/funnel-building/summary',
    title: 'Summary — Working with your marketing funnel',
  },
  // 4 Data Analytics
  {
    id: 'grow.data-analytics.4.1',
    pillar: '4 Data Analytics',
    file: 'data-analytics/4.1-overview.md',
    url: 'https://pirateskills.com/grow/codex/data-analytics/overview',
    title: 'Overview — Measure progress towards your goals',
  },
  {
    id: 'grow.data-analytics.4.2',
    pillar: '4 Data Analytics',
    file: 'data-analytics/4.2-what-we-measure.md',
    url: 'https://pirateskills.com/grow/codex/data-analytics/what-we-measure',
    title: 'What we measure — Customer journey in measurable metrics',
  },
  {
    id: 'grow.data-analytics.4.3',
    pillar: '4 Data Analytics',
    file: 'data-analytics/4.3-how-we-measure.md',
    url: 'https://pirateskills.com/grow/codex/data-analytics/how-we-measure',
    title: 'How we measure — Track each important metric',
  },
  {
    id: 'grow.data-analytics.4.4',
    pillar: '4 Data Analytics',
    file: 'data-analytics/4.4-how-we-report.md',
    url: 'https://pirateskills.com/grow/codex/data-analytics/how-we-report',
    title: 'How we report — Actionable metric reports',
  },
  {
    id: 'grow.data-analytics.4.5',
    pillar: '4 Data Analytics',
    file: 'data-analytics/4.5-what-to-improve.md',
    url: 'https://pirateskills.com/grow/codex/data-analytics/what-to-improve',
    title: 'What to improve — Bottlenecks and data-informed actions',
  },
  {
    id: 'grow.data-analytics.4.6',
    pillar: '4 Data Analytics',
    file: 'data-analytics/4.6-summary.md',
    url: 'https://pirateskills.com/grow/codex/data-analytics/summary',
    title: 'Summary — Working with your data analytics strategy',
  },
  // 5 Traffic Generation
  {
    id: 'grow.traffic-generation.5.1',
    pillar: '5 Traffic Generation',
    file: 'traffic-generation/5.1-overview.md',
    url: 'https://pirateskills.com/grow/codex/traffic-generation/overview',
    title: 'Overview — Drive more profitable traffic',
  },
  {
    id: 'grow.traffic-generation.5.2',
    pillar: '5 Traffic Generation',
    file: 'traffic-generation/5.2-channel-compass.md',
    url: 'https://pirateskills.com/grow/codex/traffic-generation/channel-compass',
    title: 'Channel compass — Making sources work together',
  },
  {
    id: 'grow.traffic-generation.5.3',
    pillar: '5 Traffic Generation',
    file: 'traffic-generation/5.3-campaign-structure.md',
    url: 'https://pirateskills.com/grow/codex/traffic-generation/campaign-structure',
    title: 'Campaign structure — Find the next profitable campaign',
  },
  {
    id: 'grow.traffic-generation.5.4',
    pillar: '5 Traffic Generation',
    file: 'traffic-generation/5.4-ad-creatives.md',
    url: 'https://pirateskills.com/grow/codex/traffic-generation/ad-creatives',
    title: 'Ad creatives — Present value as engaging as possible',
  },
  {
    id: 'grow.traffic-generation.5.5',
    pillar: '5 Traffic Generation',
    file: 'traffic-generation/5.5-explore-and-scale.md',
    url: 'https://pirateskills.com/grow/codex/traffic-generation/explore-and-scale',
    title: 'Explore & scale — Test channels; scale winners',
  },
  {
    id: 'grow.traffic-generation.5.6',
    pillar: '5 Traffic Generation',
    file: 'traffic-generation/5.6-summary.md',
    url: 'https://pirateskills.com/grow/codex/traffic-generation/summary',
    title: 'Summary — Working with traffic generation strategy',
  },
  // 6 Conversion Optimization
  {
    id: 'grow.conversion-optimization.6.1',
    pillar: '6 Conversion Optimization',
    file: 'conversion-optimization/6.1-overview.md',
    url: 'https://pirateskills.com/grow/codex/conversion-optimization/overview',
    title: 'Overview — Increase impact and profit',
  },
  {
    id: 'grow.conversion-optimization.6.2',
    pillar: '6 Conversion Optimization',
    file: 'conversion-optimization/6.2-next-experiments.md',
    url: 'https://pirateskills.com/grow/codex/conversion-optimization/next-experiments',
    title: 'Next experiments — Most important upcoming changes',
  },
  {
    id: 'grow.conversion-optimization.6.3',
    pillar: '6 Conversion Optimization',
    file: 'conversion-optimization/6.3-website-testing.md',
    url: 'https://pirateskills.com/grow/codex/conversion-optimization/website-testing',
    title: 'Website testing — Landing page conversion rate',
  },
  {
    id: 'grow.conversion-optimization.6.4',
    pillar: '6 Conversion Optimization',
    file: 'conversion-optimization/6.4-email-testing.md',
    url: 'https://pirateskills.com/grow/codex/conversion-optimization/email-testing',
    title: 'Email testing — Email conversion rate',
  },
  {
    id: 'grow.conversion-optimization.6.5',
    pillar: '6 Conversion Optimization',
    file: 'conversion-optimization/6.5-ad-testing.md',
    url: 'https://pirateskills.com/grow/codex/conversion-optimization/ad-testing',
    title: 'Ad testing — Ad conversion rate',
  },
  {
    id: 'grow.conversion-optimization.6.6',
    pillar: '6 Conversion Optimization',
    file: 'conversion-optimization/6.6-summary.md',
    url: 'https://pirateskills.com/grow/codex/conversion-optimization/summary',
    title: 'Summary — Working with conversion optimization strategy',
  },
];

function parseArgs() {
  const args = process.argv.slice(2);
  const cdpIdx = args.indexOf('--cdp');
  if (cdpIdx >= 0) return { mode: 'cdp', cdp: args[cdpIdx + 1] || 'http://127.0.0.1:9222' };
  if (args.includes('--profile')) return { mode: 'profile' };
  if (args.includes('--login')) return { mode: 'login' };
  return { mode: 'cdp', cdp: 'http://127.0.0.1:9222' };
}

async function waitForLessonContent(page) {
  await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
  // Wait until loading placeholder is gone or we have substantial text
  for (let i = 0; i < 30; i++) {
    const state = await page.evaluate(() => {
      const body = document.body?.innerText || '';
      const loading = body.includes('Loading lesson content');
      const signInOnly =
        body.includes('Sign In') && body.length < 800 && !body.includes('Why we need');
      return { loading, signInOnly, len: body.length };
    });
    if (!state.loading && !state.signInOnly && state.len > 1200) return true;
    await page.waitForTimeout(1000);
  }
  return false;
}

async function extractLesson(page) {
  return page.evaluate(() => {
    const remove = (sel) => document.querySelectorAll(sel).forEach((el) => el.remove());

    // Clone main content area — try common patterns
    const candidates = [
      'article',
      'main',
      '[class*="prose"]',
      '[class*="lesson"]',
      '[class*="content"]',
    ];
    let root = null;
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el && (el.innerText || '').length > 500) {
        root = el.cloneNode(true);
        break;
      }
    }
    if (!root) root = document.body.cloneNode(true);

    const clone = root;
    remove.call(clone, 'nav, header, footer, aside, script, style, button, [aria-label="Toggle Sidebar"]');
    clone.querySelectorAll('button').forEach((b) => b.remove());

    let text = clone.innerText || '';
    text = text
      .replace(/\n{3,}/g, '\n\n')
      .replace(/Mark Lesson Complete.*$/s, '')
      .replace(/Sign In\n/g, '')
      .replace(/Loading lesson content\.\.\./g, '')
      .trim();

    const prompts = [];
    clone.querySelectorAll('pre, code').forEach((node) => {
      const t = node.innerText?.trim();
      if (t && t.length > 80) prompts.push(t);
    });

    const h1 = document.querySelector('h1')?.innerText?.trim() || '';

    return { h1, text, prompts };
  });
}

function toMarkdown(lesson, extracted) {
  const fm = `---
source_url: ${lesson.url}
synced_at: ${SYNCED_AT}
lesson_id: ${lesson.id}
title: ${lesson.title}
dabos_pillar: ${lesson.pillar}
sync_method: playwright
---

`;
  let body = `# ${extracted.h1 || lesson.title}\n\n`;
  body += extracted.text + '\n';

  if (extracted.prompts?.length) {
    body += '\n---\n\n## Prompts (extracted)\n\n';
    for (const p of extracted.prompts) {
      body += '```text\n' + p + '\n```\n\n';
    }
  }

  return fm + body;
}

async function getBrowserContext(config) {
  if (config.mode === 'cdp') {
    const browser = await chromium.connectOverCDP(config.cdp);
    const context = browser.contexts()[0] || (await browser.newContext());
    return { browser, context, close: () => browser.close() };
  }
  if (config.mode === 'profile') {
    const userData = path.join(
      process.env.LOCALAPPDATA || '',
      'Google',
      'Chrome',
      'User Data'
    );
    const context = await chromium.launchPersistentContext(userData, {
      channel: 'chrome',
      headless: false,
    });
    return { browser: null, context, close: () => context.close() };
  }
  // login mode — temp profile
  const profileDir = path.join(__dirname, '..', '.pirate-codex-browser-profile');
  const context = await chromium.launchPersistentContext(profileDir, {
    channel: 'chrome',
    headless: false,
  });
  return { browser: null, context, close: () => context.close() };
}

async function main() {
  const config = parseArgs();
  console.log('Mode:', config.mode, config.cdp || '');

  if (config.mode === 'login') {
    console.log('\n>>> Log in at pirateskills.com in the opened browser, then press Enter here...');
    const readline = await import('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    await new Promise((r) => rl.question('', () => { rl.close(); r(); }));
  }

  const { context, close } = await getBrowserContext(config);
  const page = context.pages()[0] || (await context.newPage());

  const results = { ok: [], fail: [] };

  for (const lesson of LESSONS) {
    const outPath = path.join(OUT_ROOT, lesson.file);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });

    // Skip if already synced today with substantial content (keep 1.1 unless re-sync)
    if (fs.existsSync(outPath)) {
      const existing = fs.readFileSync(outPath, 'utf8');
      if (existing.length > 3000 && existing.includes('synced_at:')) {
        console.log('SKIP (exists):', lesson.file);
        results.ok.push(lesson.file);
        continue;
      }
    }

    console.log('FETCH:', lesson.url);
    try {
      await page.goto(lesson.url, { waitUntil: 'domcontentloaded', timeout: 90000 });
      const ready = await waitForLessonContent(page);
      const extracted = await extractLesson(page);

      if (!ready || extracted.text.length < 800) {
        throw new Error(`Content too short (${extracted.text.length} chars) — not logged in?`);
      }

      fs.writeFileSync(outPath, toMarkdown(lesson, extracted), 'utf8');
      console.log('  OK:', lesson.file, `(${extracted.text.length} chars)`);
      results.ok.push(lesson.file);
    } catch (err) {
      console.error('  FAIL:', lesson.file, err.message);
      results.fail.push({ file: lesson.file, error: err.message });
    }

    await page.waitForTimeout(500);
  }

  await close();

  const reportPath = path.join(OUT_ROOT, '..', 'sync-report.json');
  fs.writeFileSync(
    reportPath,
    JSON.stringify({ synced_at: SYNCED_AT, ok: results.ok, fail: results.fail }, null, 2)
  );
  console.log('\nDone.', results.ok.length, 'ok,', results.fail.length, 'fail');
  console.log('Report:', reportPath);
  if (results.fail.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
