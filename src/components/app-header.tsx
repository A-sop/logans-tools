'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

import { cn } from '@/lib/utils';

export interface NavItem {
  href: string;
  label: string;
}

export interface AppHeaderProps {
  logo?: ReactNode;
  /** Logo text or link content when no custom logo */
  logoHref?: string;
  logoLabel?: string;
  navItems?: NavItem[];
  className?: string;
}

/**
 * Header with logo and navigation menu.
 * Matches design system: bg-background, border-border, spacing scale.
 */
export function AppHeader({
  logo,
  logoHref = '/',
  logoLabel = 'Home',
  navItems = [],
  className,
}: AppHeaderProps) {
  return (
    <header
      role="banner"
      className={cn(
        'flex h-14 items-center justify-between border-b border-border bg-background px-4',
        className
      )}
    >
      <div className="flex items-center gap-6">
        {logo ? (
          <Link href={logoHref} className="flex items-center gap-2" aria-label={logoLabel}>
            {logo}
          </Link>
        ) : (
          <Link
            href={logoHref}
            className="text-base font-semibold tracking-tight text-foreground transition-colors hover:text-foreground/90"
            aria-label={logoLabel}
          >
            {logoLabel}
          </Link>
        )}
        {navItems.length > 0 && (
          <nav role="navigation" aria-label="Main navigation" className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors',
                  'hover:bg-accent hover:text-foreground'
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
