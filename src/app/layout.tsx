import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { LocaleProvider } from '@/components/providers/locale-provider';
import { AppShell } from '@/components/app-shell';

export const metadata: Metadata = {
  title: 'Logans.Tools',
  description: 'Logans.Tools — vibe coding, Pirate Skills, concierge for busy executives.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="antialiased">
        <LocaleProvider>
          <AppShell>{children}</AppShell>
        </LocaleProvider>
      </body>
    </html>
  );
}
