'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';

type ViewMode = 'founder' | 'deep';

const ViewModeContext = createContext<{
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
  isDeep: boolean;
} | null>(null);

export function DabosViewProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ViewMode>('founder');
  const value = useMemo(
    () => ({ mode, setMode, isDeep: mode === 'deep' }),
    [mode]
  );
  return <ViewModeContext.Provider value={value}>{children}</ViewModeContext.Provider>;
}

export function useDabosView() {
  const ctx = useContext(ViewModeContext);
  if (!ctx) throw new Error('useDabosView must be used within DabosViewProvider');
  return ctx;
}

export function ViewModeToggle() {
  const { mode, setMode } = useDabosView();
  return (
    <div className="inline-flex rounded-md border border-border p-0.5">
      <Button
        type="button"
        size="sm"
        variant={mode === 'founder' ? 'default' : 'ghost'}
        className="h-8"
        onClick={() => setMode('founder')}
      >
        Founder
      </Button>
      <Button
        type="button"
        size="sm"
        variant={mode === 'deep' ? 'default' : 'ghost'}
        className="h-8"
        onClick={() => setMode('deep')}
      >
        Deep
      </Button>
    </div>
  );
}
