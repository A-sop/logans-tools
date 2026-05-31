export const EXPAT_PLAN = {
  productName: 'Money Manual',
  tagline: 'Digital money manual · Personal walkthrough on call',
  offerTitle: 'Your digital Germany money manual',
  brandParent: 'German Financial Planning',
  landingUrl: 'https://go.germanfinancialplanning.de/money-manual',
  heroHeadline: 'Nobody handed you the money manual when you moved to Germany.',
  heroSubhead:
    'Germany offers real money to people who live and work here: tax savings, government support, employer top-ups, and long-term pension upside. Most expats never get a plain-English map. This manual shows what is possible, then walks through your numbers on a call.',
  ctaLabel: 'Get your money manual',
  coachLine:
    'Logan Williams is an expat financial coach in Cologne. He moved to Germany, navigated the bureaucracy, and helps international professionals understand subsidies, tax posture, and long-term wealth — without product pitches or jargon.',
  event: 'STARTPLATZ AI Hackathon — May 2026',
  shipTarget: 'Sun 31 May 2026, 12:00',
  lastUpdated: '2026-05-31T14:30:00+02:00',
  demoTarget: 'Sun 31 May 2026, 14:00',
  uiReference: 'https://demo-ramp.com/',
  prdPath: 'Atlas/docs/ideas/active/expat-funnel-hackathon-may-2026/PRD.md',
  productRepo: 'https://github.com/A-sop/german-financial-planning',
  productHost: 'go.germanfinancialplanning.de',
} as const;

export const PAIN_POINTS = [
  {
    id: '01',
    title: 'Nobody explained what you qualify for',
    body: 'Kindergeld, Elterngeld, Kita subsidies — expats often discover these by accident, or never.',
  },
  {
    id: '02',
    title: 'Tax leakage without a map',
    body: 'Steuerklasse, bands, and payslip confusion. Money left on the table — structurally, not through shady tricks.',
  },
  {
    id: '03',
    title: 'Advisers sell; friends explain',
    body: 'You need someone who has been here, done this, and will walk you through your numbers on a call.',
  },
] as const;

/** Headline themes on the live landing (teaser before call personalisation). */
export const DISCOVERY_THEMES = [
  {
    title: 'Tax savings you may be missing',
    body: 'How much annual tax you might save — band-based, not fantasy numbers.',
  },
  {
    title: 'Retirement upside',
    body: 'How much your retirement income could increase if you use what is available.',
  },
  {
    title: 'Government support',
    body: 'Support you may qualify for — with or without children.',
  },
] as const;

export const FUNNEL_STEPS = [
  {
    step: '01',
    title: 'Long-form sales letter',
    body: '/money-manual — three pains, coach story, CTA to dossier.',
    route: '/money-manual',
  },
  {
    step: '02',
    title: 'Questionnaire (dossier)',
    body: '/money-manual/start — family, income band, stay intent (~5 min).',
    route: '/money-manual/start',
  },
  {
    step: '03',
    title: 'Teaser after submit',
    body: '/money-manual/teaser — headline themes, not full line items.',
    route: '/money-manual/teaser',
  },
  {
    step: '04',
    title: 'Book call · full manual live',
    body: '/money-manual/book (Calendly) → personalised manual on call.',
    route: '/money-manual/book',
  },
] as const;

export type SprintStatus = 'planned' | 'done' | 'in_progress';

export const SPRINT_BLOCKS: ReadonlyArray<{
  time: string;
  focus: string;
  status: SprintStatus;
}> = [
  {
    time: '10:00–11:00',
    focus: 'GFP repo + calculator-config.json + go. subdomain',
    status: 'done',
  },
  {
    time: '11:00–13:00',
    focus: 'Sales letter (live at /money-manual)',
    status: 'done',
  },
  { time: '13:30–15:30', focus: 'Dossier wizard + income bands (/start)', status: 'done' },
  {
    time: '15:30–17:00',
    focus: 'Calculator v0 (Kindergeld, Elterngeld, Kita)',
    status: 'done',
  },
  { time: '17:00–18:30', focus: 'Teaser + discovery themes (/teaser)', status: 'done' },
  { time: '18:30–19:15', focus: 'Admin full manual + Calendly (/book)', status: 'done' },
  { time: '19:15–20:00', focus: 'Ship — smoke test + disclaimers', status: 'in_progress' },
];

export const P0_CHECKLIST = [
  { label: 'Money Manual landing live (go.germanfinancialplanning.de/money-manual)', done: true },
  { label: 'Dossier wizard → Neon Postgres leads', done: true },
  { label: 'Calculator with 2026 config (calculate-advantages.ts)', done: true },
  { label: 'Teaser after submit (/money-manual/teaser)', done: true },
  { label: 'Full manual template + admin leads view', done: true },
  { label: 'Calendly book-call CTA (/money-manual/book)', done: true },
  { label: 'Impressum / Datenschutz on GFP site', done: false },
  { label: 'Build log published (logans.tools/expat)', done: true },
] as const;

export const PREVIEW_SCORES = [
  { label: 'Kindergeld (2026)', score: 100, note: '€259 / child / month' },
  { label: 'Elterngeld estimate', score: 72, note: 'Band-based · verify on call' },
  { label: 'Kita / subsidy frame', score: 58, note: 'NRW illustrative band' },
  { label: 'Tax posture flag', score: 45, note: 'Qualitative until income captured' },
] as const;

export const RATES_2026 = [
  { item: 'Kindergeld', value: '€259 / month / child', source: 'BKGG §6' },
  { item: 'Elterngeld (Basis)', value: '€300 – €1,800 / month', source: 'BEEG §2' },
  { item: 'Blue Card threshold', value: '€50,700 gross (2026)', source: '§18g AufenthG' },
  { item: 'Retirement age', value: '67 (30yr fallback if no age)', source: 'PRD §16' },
  { item: 'Projection rate', value: '2.5% real · 2% inflation disclosed', source: 'PRD §16' },
] as const;

export type TechStackStatus = 'live' | 'planned' | 'fallback';

export const TECH_STACK = [
  {
    layer: 'Product app',
    tools: 'Next.js 15 · React 19 · TypeScript · Vercel',
    role: 'Money Manual funnel — landing, dossier, teaser, book, admin',
    status: 'live' as TechStackStatus,
    href: 'https://github.com/A-sop/german-financial-planning',
  },
  {
    layer: 'Product host',
    tools: 'go.germanfinancialplanning.de',
    role: 'Campaign subdomain via middleware + campaigns/config.ts',
    status: 'live' as TechStackStatus,
    href: 'https://go.germanfinancialplanning.de/money-manual',
  },
  {
    layer: 'Leads & CRM',
    tools: 'Neon Postgres · Attio sync',
    role: 'Campaign leads repository + optional Attio handoff',
    status: 'live' as TechStackStatus,
    href: 'https://neon.tech',
  },
  {
    layer: 'Build log',
    tools: 'logans.tools · Next.js · Vercel',
    role: 'This page — sprint plan, stack, locked decisions',
    status: 'live' as TechStackStatus,
    href: 'https://logans.tools/expat',
  },
  {
    layer: 'Calculator config',
    tools: 'calculator-config.json · calculate-advantages.ts',
    role: '2026 Kindergeld, Elterngeld, Kita bands — cited in report footer',
    status: 'live' as TechStackStatus,
  },
  {
    layer: 'Call booking',
    tools: 'Calendly embed',
    role: 'Primary CTA — book walkthrough for full manual',
    status: 'live' as TechStackStatus,
    href: 'https://calendly.com',
  },
  {
    layer: 'Hackathon platform',
    tools: 'Base44 (sponsor credits)',
    role: 'Explored during hackathon — not primary product stack',
    status: 'planned' as TechStackStatus,
    href: 'https://base44.com',
  },
  {
    layer: 'Email',
    tools: 'Resend',
    role: 'Teaser delivery + follow-up after questionnaire',
    status: 'planned' as TechStackStatus,
    href: 'https://resend.com',
  },
  {
    layer: 'Dev & AI',
    tools: 'Cursor · Claude / GPT agents',
    role: 'Build, copy, calculator logic, this build log',
    status: 'live' as TechStackStatus,
    href: 'https://cursor.com',
  },
  {
    layer: 'UI reference',
    tools: 'demo-ramp.com',
    role: 'Report-card layout, score dimensions, checklist patterns',
    status: 'live' as TechStackStatus,
    href: 'https://demo-ramp.com/',
  },
] as const;

export const CREDITS = {
  team: [{ name: 'Logan Williams', role: 'Product · coach · integrator' }],
  event: {
    name: 'STARTPLATZ AI Hackathon',
    when: 'May 2026 · Köln',
    href: 'https://startplatz.notion.site/AI-Hackathon-Participant-Guide-May-2026-788851ee5b064878bb3543f7fdaf6bdf',
  },
  sponsors: [
    {
      name: 'Base44',
      note: 'Hackathon sponsor · app platform · MAY100EDU credits',
      href: 'https://base44.com',
    },
    {
      name: 'Pirate Skills',
      note: 'Builder Codex · build in public · pitch framing',
      href: 'https://pirateskills.com',
    },
  ],
  brand: {
    name: 'German Financial Planning',
    href: 'https://www.germanfinancialplanning.de',
  },
} as const;
