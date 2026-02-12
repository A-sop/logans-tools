import * as React from 'react';

import { cn } from '@/lib/utils';

export interface DataListItem {
  id: string;
  /** Primary content */
  title: React.ReactNode;
  /** Optional subtitle/description */
  subtitle?: React.ReactNode;
  /** Optional trailing content (e.g. badge, actions) */
  trailing?: React.ReactNode;
}

export interface DataListProps {
  items: DataListItem[];
  /** Optional empty state */
  emptyMessage?: React.ReactNode;
  className?: string;
}

/**
 * List display for structured data. Matches design system:
 * borders, spacing (p-4), typography (text-sm, font-medium, text-muted-foreground).
 */
export function DataList({ items, emptyMessage = 'No items', className }: DataListProps) {
  if (items.length === 0) {
    return (
      <div
        className={cn(
          'rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground',
          className
        )}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <ul role="list" className={cn('divide-y divide-border rounded-lg border border-border', className)}>
      {items.map((item) => (
        <li
          key={item.id}
          className={cn(
            'flex items-center justify-between gap-4 px-4 py-3 transition-colors',
            'hover:bg-muted/50'
          )}
        >
          <div className="min-w-0 flex-1">
            <div className="font-medium text-foreground">{item.title}</div>
            {item.subtitle && (
              <div className="text-xs text-muted-foreground">{item.subtitle}</div>
            )}
          </div>
          {item.trailing && <div className="shrink-0">{item.trailing}</div>}
        </li>
      ))}
    </ul>
  );
}
