import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'DABOS Organizing Board',
  description: 'Digital Agent Business Orchestrator System',
};

export default function DabosLayout({ children }: { children: ReactNode }) {
  return (
    <div className="dabos-standalone mx-auto w-full max-w-none px-3 py-5 sm:px-4 sm:py-6">
      {children}
    </div>
  );
}
