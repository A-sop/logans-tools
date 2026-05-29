export const EXPAT_PLAN = {
  productName: 'German-AI-der',
  offerTitle: 'Set Yourself Up in Germany',
  event: 'STARTPLATZ AI Hackathon — May 2026',
  shipTarget: 'Sat 30 May 2026, 20:00',
  demoTarget: 'Sun 31 May 2026, 14:00',
  uiReference: 'https://demo-ramp.com/',
  prdPath: 'Atlas/docs/ideas/active/expat-funnel-hackathon-may-2026/PRD.md',
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

export const FUNNEL_STEPS = [
  {
    step: '01',
    title: 'Long-form sales letter',
    body: 'Direct-response copy (Halbert / Kern style). Three pains → one CTA.',
  },
  {
    step: '02',
    title: 'Dossier wizard',
    body: 'Age, family, stay intent, income bands — multi-step, premium feel.',
  },
  {
    step: '03',
    title: 'Generic preview report',
    body: 'Instant illustrative report: Blue Card couple, one child under 14.',
  },
  {
    step: '04',
    title: 'Full report on call',
    body: 'Personalized numbers screen-shared live. WhatsApp to book.',
  },
] as const;

export const SPRINT_BLOCKS = [
  { time: '10:00–11:00', focus: 'Base44 + calculator-config.json', status: 'planned' as const },
  { time: '11:00–13:00', focus: 'Sales letter v0', status: 'planned' as const },
  { time: '13:30–15:30', focus: 'Dossier wizard + bands', status: 'planned' as const },
  { time: '15:30–17:00', focus: 'Calculator v0 (Kindergeld, Elterngeld, Kita)', status: 'planned' as const },
  { time: '17:00–18:30', focus: 'Generic preview + charts', status: 'planned' as const },
  { time: '18:30–19:15', focus: 'Admin full report + WhatsApp CTA', status: 'planned' as const },
  { time: '19:15–20:00', focus: 'Ship — smoke test + disclaimers', status: 'planned' as const },
];

export const P0_CHECKLIST = [
  { label: 'Sales letter live', done: false },
  { label: 'Dossier → Base44 DB', done: false },
  { label: 'Calculator with 2026 config constants', done: false },
  { label: 'Generic preview (fixed persona)', done: false },
  { label: 'Full report (admin only)', done: false },
  { label: 'WhatsApp book-call CTA', done: false },
  { label: 'Impressum / Datenschutz stub', done: false },
  { label: 'Build log published (this page)', done: true },
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
