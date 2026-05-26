import { Badge } from '@/components/ui/badge';
import type { TransactionRow } from '@/lib/ldw-data';
import { cn, formatEur } from '@/lib/utils';

type Props = {
  rows: TransactionRow[];
  limit?: number;
};

function EurCell({ zeile, label }: { zeile: string; label: string }) {
  if (!zeile) return <span className="text-muted-foreground">—</span>;
  return (
    <span title={label || undefined}>
      <span className="font-medium tabular-nums">{zeile}</span>
      {label ? (
        <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2">
          {label.replace(/^\d+\s*-\s*/, '')}
        </span>
      ) : null}
    </span>
  );
}

function TransactionCard({ row }: { row: TransactionRow }) {
  return (
    <article
      className={cn(
        'rounded-lg border border-border bg-card p-3',
        row.needsReview && 'border-primary/40 bg-muted/30'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{row.date}</p>
          <p className="truncate font-medium">{row.payee}</p>
        </div>
        <div className="shrink-0 text-right">
          <Badge variant={row.direction === 'in' ? 'default' : 'secondary'} className="mb-1">
            {row.direction === 'in' ? 'In' : 'Out'}
          </Badge>
          <p className="text-sm font-semibold tabular-nums">{formatEur(row.amount)}</p>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">SKR03</dt>
          <dd className="font-mono font-medium">{row.skr03 || '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">EÜR</dt>
          <dd>
            <EurCell zeile={row.eurZeile} label={row.eurLabel} />
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-muted-foreground">Account</dt>
          <dd className="truncate text-muted-foreground">{row.suggestedAccount || '—'}</dd>
        </div>
      </dl>
    </article>
  );
}

export function TransactionsTable({ rows, limit }: Props) {
  const visible = limit ? rows.slice(0, limit) : rows;

  return (
    <>
      <div className="space-y-3 md:hidden">
        {visible.map((row) => (
          <TransactionCard key={row.id} row={row} />
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 pr-3">Date</th>
              <th className="pb-2 pr-3">In / Out</th>
              <th className="pb-2 pr-3">Payee</th>
              <th className="pb-2 pr-3 text-right">Amount</th>
              <th className="pb-2 pr-3">SKR03</th>
              <th className="pb-2 pr-3">EÜR</th>
              <th className="pb-2 pr-3">Account</th>
              <th className="pb-2 pr-3">Bank</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={row.id}
                className={cn('border-b border-border/50', row.needsReview && 'bg-muted/30')}
              >
                <td className="whitespace-nowrap py-2 pr-3">{row.date}</td>
                <td className="py-2 pr-3">
                  <Badge variant={row.direction === 'in' ? 'default' : 'secondary'}>
                    {row.direction === 'in' ? 'In' : 'Out'}
                  </Badge>
                </td>
                <td className="max-w-[200px] truncate py-2 pr-3" title={row.payee}>
                  {row.payee}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{formatEur(row.amount)}</td>
                <td className="whitespace-nowrap py-2 pr-3 font-mono text-xs">
                  {row.skr03 || <span className="text-muted-foreground">—</span>}
                </td>
                <td className="max-w-[220px] py-2 pr-3">
                  <EurCell zeile={row.eurZeile} label={row.eurLabel} />
                </td>
                <td
                  className="max-w-[160px] truncate py-2 pr-3 text-muted-foreground"
                  title={row.suggestedAccount}
                >
                  {row.suggestedAccount || '—'}
                </td>
                <td className="max-w-[100px] truncate py-2 pr-3 text-xs text-muted-foreground">
                  {row.bank}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
