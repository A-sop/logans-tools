'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const links = [
  { href: '/euer', label: 'Dashboard' },
  { href: '/euer/inbox', label: 'Inbox' },
  { href: '/euer/ledger', label: 'Transactions' },
  { href: '/euer/tax', label: 'Tax (EÜR)' },
];

export function EuerHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-6 px-4">
        <div className="flex items-center gap-6">
          <Link href="/euer" className="text-sm font-semibold tracking-tight">
            LDW Books
          </Link>
          <nav className="flex gap-1">
            {links.map((link) => {
              const active =
                pathname === link.href ||
                (link.href !== '/euer' && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                    active && 'bg-accent text-foreground'
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <span className="text-xs text-muted-foreground">euer.logans.tools</span>
      </div>
    </header>
  );
}
