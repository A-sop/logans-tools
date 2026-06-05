'use client';

import type { ReactNode } from 'react';

import { useDabosView } from '@/components/dabos/view-mode';

export function DabosDevPanel({ children }: { children: ReactNode }) {
  const { isDeep } = useDabosView();
  if (!isDeep) return null;
  return <div className="mt-10 space-y-6 border-t border-dashed border-border pt-8">{children}</div>;
}
