import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Money Manual — Hackathon build log | logans.tools',
  description:
    'Work in progress: Money Manual expat funnel for STARTPLATZ AI Hackathon May 2026 — German Financial Planning.',
  robots: { index: false, follow: false },
};

export default function ExpatLayout({ children }: { children: ReactNode }) {
  return children;
}
