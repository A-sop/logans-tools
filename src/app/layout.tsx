import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import './globals.css';
import { LocaleProvider } from '@/components/providers/locale-provider';
import { AppShell } from '@/components/app-shell';
import { MIDDLEWARE_LOCALE_HEADER, pickLocaleFromMiddlewareHeader } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'Logans.Tools',
  description: 'Logans.Tools — vibe coding, Pirate Skills, concierge for busy executives.',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const h = await headers();
  const initialLocale = pickLocaleFromMiddlewareHeader(h.get(MIDDLEWARE_LOCALE_HEADER));
  const htmlLang = initialLocale === 'de' ? 'de' : 'en';

  return (
    <html lang={htmlLang} suppressHydrationWarning>
      <body className="antialiased">
        <LocaleProvider initialLocale={initialLocale}>
          <AppShell>{children}</AppShell>
        </LocaleProvider>
      </body>
    </html>
  );
}
