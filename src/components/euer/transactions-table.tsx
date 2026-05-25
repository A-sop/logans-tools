import { Badge } from '@/components/ui/badge';
import type { TransactionRow } from '@/lib/ldw-data';
import { formatEur } from '@/lib/utils';

type Props = {
  rows: TransactionRow[];
  limit?: number;
};

export function TransactionsTable({ rows, limit }: Props) {
  const visible = limit ? rows.slice(0, limit) : rows;

  return (
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
          <tr key={row.id} className="border-b border-border/50">
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
              {row.skr03 || (
                <span className="text-muted-foreground" title="No SKR from rules or chart">
                  —
                </span>
              )}
            </td>
            <td className="max-w-[220px] py-2 pr-3">
              {row.eurZeile ? (
                <span title={row.eurLabel || undefined}>
                  <span className="font-medium tabular-nums">{row.eurZeile}</span>
                  {row.eurLabel ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {row.eurLabel.replace(/^\d+\s*-\s*/, '')}
                    </span>
                  ) : null}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </td>
            <td className="max-w-[160px] truncate py-2 pr-3 text-muted-foreground" title={row.suggestedAccount}>
              {row.suggestedAccount || '—'}
            </td>
            <td className="max-w-[100px] truncate py-2 pr-3 text-xs text-muted-foreground">{row.bank}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
