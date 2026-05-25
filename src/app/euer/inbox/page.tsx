import { Suspense } from 'react';
import { TransactionsTable } from '@/components/euer/transactions-table';
import { YearSelect } from '@/components/euer/year-select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getAvailableYears, getTransactionRows } from '@/lib/ldw-data';

type PageProps = { searchParams: Promise<{ year?: string }> };

export default async function EuerInboxPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const years = getAvailableYears();
  const year = params.year ? Number(params.year) : years[0] ?? 2024;
  const rows = getTransactionRows(year).filter((r) => r.needsReview);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inbox</h1>
          <p className="text-sm text-muted-foreground">
            Lines to confirm: missing SKR03 or EÜR, review hat, splits, or low confidence.
          </p>
        </div>
        <Suspense fallback={null}>
          <YearSelect years={years} currentYear={year} />
        </Suspense>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{rows.length} items</CardTitle>
          <CardDescription>Subset of transactions — same SKR03 / EÜR columns as the ledger</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing flagged for review in {year}.</p>
          ) : (
            <TransactionsTable rows={rows} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
