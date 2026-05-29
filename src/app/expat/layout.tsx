import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'German-AI-der — Hackathon build log | expat.logans.tools',
  description:
    'Work in progress: expat funnel for STARTPLATZ AI Hackathon May 2026 — Set Yourself Up in Germany.',
  robots: { index: false, follow: false },
};

export default function ExpatLayout({ children }: { children: ReactNode }) {
  return children;
}
