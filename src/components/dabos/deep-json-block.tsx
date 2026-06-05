'use client';

import { useDabosView } from '@/components/dabos/view-mode';

export function DeepJsonBlock({ label, data }: { label: string; data: unknown }) {
  const { isDeep } = useDabosView();
  if (!isDeep) return null;

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label} (Deep)
      </p>
      <pre className="overflow-x-auto text-xs">{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
