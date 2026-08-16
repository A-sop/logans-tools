/**
 * Public changelog entries. Add new entries at the top.
 * Format: { date, version?, title, items }
 */
export type ChangelogEntry = {
  date: string;
  version?: string;
  title: string;
  items: string[];
};

export const changelogEntries: ChangelogEntry[] = [
  {
    date: '2026-08-16',
    title: 'Supabase → Neon offboard (A-188)',
    items: [
      'Database: Neon Postgres is the sole online DB for product paths (DATABASE_URL)',
      'Scaffolding: archived legacy supabase/ SQL; removed supabase CLI dependency',
      'Env: SUPABASE_* removed from required checks and Vercel production (GFP + local)',
    ],
  },
  {
    date: '2026-02-12',
    version: '1.0',
    title: 'v1.0 — Consulting & More Workspace Launch',
    items: [
      'Workspace: assignments, tasks, documents, contacts, and timeline',
      'Authentication: Clerk sign-in/sign-up with onboarding flow',
      'Database: Supabase with RLS for tasks and documents',
      'Billing: Pricing page with CM Operator plan (€89/month)',
      'Feature gating: Workspace access requires active subscription',
      'Webhooks: Clerk Billing events sync to Supabase subscriptions table',
      'Feedback: Modal to collect user feedback with n8n integration',
      'i18n: English and German support',
    ],
  },
];
