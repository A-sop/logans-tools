import Link from 'next/link';

import {
  enrichDigestNeedItems,
  type DigestNeedItem,
} from '@/lib/dabos/digest-need-links';
import type { PendingApproval } from '@/lib/dabos/status-digest';
import { cn } from '@/lib/utils';

function NeedRow({ item }: { item: DigestNeedItem }) {
  const external = item.href?.startsWith('http');
  const titleClass =
    'text-sm font-medium leading-snug text-foreground underline-offset-2 hover:underline';

  return (
    <li className="px-3 py-2.5 sm:px-4">
      {item.href ? (
        <Link
          href={item.href}
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          className={titleClass}
        >
          {item.title}
        </Link>
      ) : (
        <span className="text-sm font-medium leading-snug text-foreground">{item.title}</span>
      )}
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[color:var(--dabos-muted-on-surface)]">
        {item.ref ? (
          <span className="font-mono tabular-nums capitalize">{item.ref}</span>
        ) : null}
        {item.note ? <span>{item.note}</span> : null}
        {item.kind === 'approval' && item.approvalId ? (
          <span className="font-mono tabular-nums opacity-80">{item.approvalId.slice(0, 8)}…</span>
        ) : null}
      </div>
    </li>
  );
}

export function DigestNeedRows({
  items,
  pendingApprovals,
  empty,
  className,
}: {
  items: string[];
  pendingApprovals?: PendingApproval[];
  empty: string;
  className?: string;
}) {
  if (!items.length) {
    return <p className={cn('text-sm text-muted-foreground', className)}>{empty}</p>;
  }
  const rows = pendingApprovals?.length
    ? enrichDigestNeedItems(items, pendingApprovals)
    : items.map((line) => enrichDigestNeedItems([line], [])[0]!);

  return (
    <ul
      className={cn(
        'divide-y divide-border/80 rounded-lg border border-border bg-card',
        className
      )}
    >
      {rows.map((item, i) => (
        <NeedRow key={`${i}-${item.approvalId ?? item.title.slice(0, 32)}`} item={item} />
      ))}
    </ul>
  );
}
