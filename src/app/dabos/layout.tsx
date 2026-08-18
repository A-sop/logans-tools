import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { DabosChrome } from '@/components/dabos/dabos-chrome';
import { DabosViewProvider } from '@/components/dabos/view-mode';
import { dabosConfigured, fetchDabosShell } from '@/lib/dabos/server-data';

export const metadata: Metadata = {
  title: 'DABOS Organizing Board',
  description: 'Digital Agent Business Orchestrator System',
};

/** Clerk-gated; must not be CDN-cached as a signed-out 404. */
export const dynamic = 'force-dynamic';

export default async function DabosLayout({ children }: { children: ReactNode }) {
  const shell = dabosConfigured() ? await fetchDabosShell() : null;

  return (
    <DabosViewProvider>
      <div className="dabos-standalone mx-auto w-full max-w-none px-3 py-5 sm:px-4 sm:py-6">
        <DabosChrome shell={shell} />
        {children}
      </div>
    </DabosViewProvider>
  );
}
