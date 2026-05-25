import { Suspense } from 'react';
import { YearSelect } from '@/components/euer/year-select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getAvailableYears, getInboxRows } from '@/lib/ldw-data';
import { formatEur } from '@/lib/utils';

type PageProps = { searchParams: Promise<{ year?: string }> };

export default async function EuerInboxPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const years = getAvailableYears();
  const year = params.year ? Number(params.year) : years[0] ?? 2024;
  const rows = getInboxRows(year);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inbox</h1>
          <p className="text-sm text-muted-foreground">Review queue from booking rules.</p>
        </div>
        <Suspense fallback={null}>
          <YearSelect years={years} currentYear={year} />
        </Suspense>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{rows.length} items</CardTitle>
          <CardDescription>Hat: review / liability_split</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing in the review queue for {year}.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-3">Date</th>
                  <th className="pb-2 pr-3">Payee</th>
                  <th className="pb-2 pr-3 text-right">Amount</th>
                  <th className="pb-2 pr-3">Hat</th>
                  <th className="pb-2 pr-3">Suggested</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 150).map((row, i) => (
                  <tr key={`${row.date}-${i}`} className="border-b border-border/50">
                    <td className="whitespace-nowrap py-2 pr-3">{row.date}</td>
                    <td className="max-w-[200px] truncate py-2 pr-3">{row.payee}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatEur(row.amount)}</td>
                    <td className="py-2 pr-3">
                      <Badge variant="outline">{row.hat}</Badge>
                    </td>
                    <td className="max-w-[180px] truncate py-2 pr-3 text-muted-foreground">
                      {row.suggestedAccount || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
