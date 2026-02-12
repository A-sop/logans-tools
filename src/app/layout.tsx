import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: "Logan's Tools",
  description: "Logan's tools and projects hub — how I work, what I build.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="antialiased">
        <header className="flex h-14 items-center justify-between border-b border-border px-4">
          <Link
            href="/"
            className="text-base font-semibold tracking-tight text-foreground"
            aria-label="Logan's Tools home"
          >
            logans.tools
          </Link>
          <nav className="flex gap-2">
            <Link
              href="/#projects"
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Projects
            </Link>
            <Link
              href="/#how-i-work"
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              How I Work
            </Link>
          </nav>
        </header>
        <main className="min-h-[calc(100vh-3.5rem)]">{children}</main>
        <footer className="border-t border-border px-4 py-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Logan Williams
        </footer>
      </body>
    </html>
  );
}
