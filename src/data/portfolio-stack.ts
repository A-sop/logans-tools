export type ReferralStatus =
  | 'active' // Logan has a link today
  | 'apply' // Public program — sign up for a link
  | 'rewards' // Referral exists but pays merch/credits, not cash
  | 'partner-only' // B2B / integration partner track, not creator affiliate
  | 'none'; // No meaningful public referral program

export type PortfolioTool = {
  label: string;
  href?: string;
  referral?: ReferralStatus;
  /** Apply URL or program docs when referral is not active yet */
  programUrl?: string;
  note?: string;
};

/** Tools Logan uses — homepage "How I work" + referral research (Jun 2026). */
export const PORTFOLIO_STACK: PortfolioTool[] = [
  {
    label: 'Cursor (AI-assisted development)',
    href: 'https://cursor.com/referral?code=JN8FVLORFFGY',
    referral: 'active',
    programUrl: 'https://cursor.com/dashboard/referrals',
    note: 'Limited rollout — $25 usage credits per paying referral (not cash). Referee: 50% off first month. Check dashboard for eligibility.',
  },
  {
    label: 'Wispr Flow (voice input)',
    href: 'https://wisprflow.ai/r?LOGAN441',
    referral: 'active',
    programUrl: 'https://partners.dub.co/flow',
    note: 'User referral = free Pro month; Dub affiliate = 25% recurring 12mo if you apply separately.',
  },
  { label: 'Next.js, React, TypeScript', referral: 'none' },
  { label: 'Tailwind CSS, shadcn/ui', referral: 'none' },
  {
    label: 'Linear (task management)',
    referral: 'apply',
    programUrl: 'https://linear.app',
    note: 'Agency/consultancy partner program — manual approval; startup perks via accelerators only.',
  },
  {
    label: 'Vercel (deployment)',
    referral: 'apply',
    programUrl: 'https://partners.dub.co/v0',
    note: 'v0 affiliate via Dub ($5/lead + 30% × 6mo). General Vercel hosting = partner ecosystem, not creator affiliate.',
  },
  {
    label: 'Neon Postgres',
    referral: 'partner-only',
    programUrl: 'https://neon.com/programs/open-source',
    note: 'Portfolio DB target — GFP campaign_leads + DABOS code path. Open-source program has referral payouts; no consumer affiliate.',
  },
  {
    label: 'Resend (email)',
    referral: 'apply',
    programUrl: 'https://www.resend.com/insiders',
    note: 'No public affiliate yet — Insiders ambassador (credits/swag). Referral program in hiring backlog.',
  },
  {
    label: 'PostHog (analytics)',
    referral: 'partner-only',
    programUrl: 'https://posthog.com/partnerships',
    note: 'Selective partnerships only — register interest; no self-serve affiliate.',
  },
  {
    label: 'Clerk (auth)',
    referral: 'apply',
    programUrl: 'https://clerk.com/creators',
    note: 'Creator partnership (free Pro, swag) — not a standard commission affiliate.',
  },
  {
    label: 'Supabase (Postgres)',
    referral: 'partner-only',
    programUrl: 'https://supabase.com/partners',
    note: 'Legacy Atlas/logans-tools migrations — migrate to Neon; no creator referral link.',
  },
  {
    label: 'Stripe (payments)',
    referral: 'partner-only',
    programUrl: 'https://stripe.com/partners/become-a-partner',
    note: 'Partner ecosystem for agencies/platforms — separate from Stripe Referral Program (pick one).',
  },
  {
    label: 'OpenRouter (model routing)',
    referral: 'rewards',
    programUrl: 'https://openrouter.ai',
    note: '$5 credit each when referee spends $10+ — link in OpenRouter dashboard; no public Dub-style affiliate.',
  },
  {
    label: 'n8n (automation)',
    referral: 'apply',
    programUrl: 'https://dash.partnerstack.com/application?company=n8n&group=affiliates2025',
    note: '30% rev share × 12mo on Cloud Starter/Pro via PartnerStack. No paid ads.',
  },
  {
    label: 'Attio (CRM)',
    referral: 'rewards',
    programUrl: 'https://www.attio.com/refer',
    note: '10% off for referee; referrer earns points → merch/hardware, not cash.',
  },
  {
    label: 'Cal.com (booking)',
    referral: 'apply',
    programUrl: 'https://partners.dub.co/cal',
    note: 'Migrating from Calendly. 20% recurring × 12mo; referee 20% off × 12mo. No paid ads. Dashboard: app.cal.com/refer.',
  },
  {
    label: 'iubenda (CMP / legal docs)',
    referral: 'apply',
    programUrl: 'https://www.iubenda.com/en/help/149409-join-the-iubenda-affiliate-program-2/',
    note: '30–40% on first purchase (30-day cookie); referee 10% off. Agency track: 20% recurring via partners@iubenda.com.',
  },
  {
    label: 'Cookiebot / Usercentrics (CMP alt)',
    referral: 'apply',
    programUrl: 'https://www.cookiebot.com/us/affiliates/',
    note: '30% × 12mo on Premium via Impact — if CMP choice goes Cookiebot instead of iubenda.',
  },
  {
    label: 'GitHub',
    referral: 'partner-only',
    programUrl: 'https://github.com/partners',
    note: 'Technology/services partner tracks — not a developer affiliate link.',
  },
];
