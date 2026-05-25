import type { ReactNode } from 'react';
import { EuerHeader } from '@/components/euer/euer-header';

export default function EuerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <EuerHeader />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </>
  );
}
