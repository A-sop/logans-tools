import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import './globals.css';

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
        <header className="flex h-14 items-center justify-center border-b border-border px-4">
          <Link
            href="/"
            className="text-base font-semibold tracking-tight text-foreground"
            aria-label="Logans.Tools home"
          >
            Logans.Tools
          </Link>
        </header>
        <main className="min-h-[calc(100vh-3.5rem)]">{children}</main>
        <footer className="border-t border-border px-4 py-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Logan Williams
          {' · '}
          <Link
            href="https://loganwilliams.com/legal#impressum"
            className="text-primary underline underline-offset-2 hover:text-primary/90 transition-colors"
          >
            Impressum
          </Link>
        </footer>
      </body>
    </html>
  );
}
