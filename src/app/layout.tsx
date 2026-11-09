import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { RootBodyShell } from '@/components/root-body-shell';
import { defaultLocale } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'Logans.Tools',
  description: 'Logans.Tools — vibe coding, Pirate Skills, concierge for busy executives.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const htmlLang = defaultLocale === 'de' ? 'de' : 'en';

  return (
    <ClerkProvider
      appearance={{
        layout: {
          // PRD-014 Phase A: founder DABOS surface — no Clerk first-user / dev marketing chrome
          unsafe_disableDevelopmentModeWarnings: true,
        },
      }}
    >
      <html lang={htmlLang} suppressHydrationWarning>
        <body className="antialiased">
          <RootBodyShell>{children}</RootBodyShell>
        </body>
      </html>
    </ClerkProvider>
  );
}
