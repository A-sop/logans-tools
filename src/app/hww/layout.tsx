import type { ReactNode } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'HWW',
  robots: { index: false, follow: false },
};

export default function HwwLayout({ children }: { children: ReactNode }) {
  return <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>;
}
