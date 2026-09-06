import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

/** Public Funnel URL for Field Journal on ln02 (Clerk-gated; no Tailscale needed). */
export const FIELD_JOURNAL_URL = 'https://ln02.tailbe6d72.ts.net:3010/sign-in';

export const metadata: Metadata = {
  title: 'Reisejournal | Logans.Tools',
  description: 'Private trip journal for Logan & Reza — Continues to Google sign-in.',
  robots: { index: false, follow: false },
};

/**
 * One-tap onboarding for Reza: no Tailscale install.
 * Journal is exposed only via Tailscale Funnel on :3010; Vaultwarden stays tailnet-only.
 */
export default function ReisePage() {
  redirect(FIELD_JOURNAL_URL);
}
