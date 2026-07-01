import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { DabosChrome } from '@/components/dabos/dabos-chrome';
import { dabosConfigured, fetchDabosShell } from '@/lib/dabos/server-data';

export const metadata: Metadata = {
  title: 'DABOS Organizing Board',
  description: 'Digital Agent Business Orchestrator System',
};

export default async function DabosLayout({ children }: { children: ReactNode }) {
  const shell = dabosConfigured() ? await fetchDabosShell() : null;

  return (
    <div className="dabos-standalone mx-auto w-full max-w-none px-3 py-5 sm:px-4 sm:py-6">
      <DabosChrome shell={shell} />
      {children}
    </div>
  );
}
