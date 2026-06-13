'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';
import { LocaleProvider } from '@/components/providers/locale-provider';
import { defaultLocale } from '@/lib/i18n';
import { shouldUseMarketingLayout } from '@/lib/marketing-layout';

/**
 * Chooses AppShell vs bare children without root `headers()`.
 * Hostname is only available after mount; pathname covers most standalone routes on SSR.
 */
export function RootBodyShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [host, setHost] = useState<string | undefined>(undefined);

  useEffect(() => {
    setHost(window.location.hostname);
  }, []);

  const isMarketing = shouldUseMarketingLayout(host, pathname ?? undefined, false);

  if (isMarketing) {
    return <>{children}</>;
  }

  return (
    <LocaleProvider initialLocale={defaultLocale}>
      <AppShell>{children}</AppShell>
    </LocaleProvider>
  );
}
