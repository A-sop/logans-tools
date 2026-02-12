'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  type Locale,
  defaultLocale,
  getStoredLocale,
  setStoredLocale,
  t as translate,
} from '@/lib/i18n';

type LocaleContextValue = {
  locale: Locale;
  setLocale: (_newLocale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = getStoredLocale();
    if (stored) setLocaleState(stored);
    setMounted(true);
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    setStoredLocale(newLocale);
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }

  return <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    return {
      locale: defaultLocale,
      setLocale: () => {},
      t: (key: string, _params?: Record<string, string>) => key,
    };
  }
  return {
    ...ctx,
    t: (key: string, params?: Record<string, string>) => translate(ctx.locale, key, params),
  };
}
