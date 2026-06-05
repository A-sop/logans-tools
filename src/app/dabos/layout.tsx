import type { ReactNode } from 'react';

export default function DabosLayout({ children }: { children: ReactNode }) {
  return <div className="w-full max-w-none px-2 py-4 sm:px-3">{children}</div>;
}
