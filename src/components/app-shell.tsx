'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { LanguageToggle } from '@/components/language-toggle';
import { useLocale } from '@/components/providers/locale-provider';
import { QuickSearch } from '@/components/quick-search';

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useLocale();

  return (
    <>
      <header className="flex h-14 items-center justify-center border-b border-border px-4">
        <div className="flex w-full max-w-4xl items-center justify-between gap-4">
          <Link
            href="/"
            className="text-base font-semibold tracking-tight text-foreground"
            aria-label={t('layout.homeAriaLabel')}
          >
            {t('layout.siteName')}
          </Link>
          <div className="flex items-center gap-2">
            <QuickSearch />
            <LanguageToggle />
          </div>
        </div>
      </header>

      <main className="min-h-[calc(100vh-3.5rem)]">{children}</main>

      <footer className="border-t border-border px-4 py-6 text-center text-xs text-muted-foreground">
        {t('layout.copyright', { year: String(new Date().getFullYear()) })}
        {' · '}
        <Link
          href="https://loganwilliams.com/legal#impressum"
          className="text-primary underline underline-offset-2 transition-colors hover:text-primary/90"
        >
          {t('layout.impressum')}
        </Link>
      </footer>
    </>
  );
}

