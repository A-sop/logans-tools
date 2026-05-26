import { Suspense } from 'react';
import { TransactionsTable } from '@/components/euer/transactions-table';
import { YearSelect } from '@/components/euer/year-select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getAvailableYears, getPaths, getTransactionRows } from '@/lib/ldw-data';

type PageProps = { searchParams: Promise<{ year?: string }> };

export default async function EuerLedgerPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const years = getAvailableYears();
  const year = params.year ? Number(params.year) : years[0] ?? 2024;
  const rows = getTransactionRows(year);
  const paths = getPaths();
  const inCount = rows.filter((r) => r.direction === 'in').length;
  const outCount = rows.filter((r) => r.direction === 'out').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            Money in and out with SKR03 and EÜR Zeile. Transfers and private lines are excluded.
          </p>
        </div>
        <Suspense fallback={null}>
          <YearSelect years={years} currentYear={year} />
        </Suspense>
      </div>

      {paths.dataSource === 'bundled' ? (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Bundled CSVs from the repo. Locally, all <code>!_TAXES-{year}</code> booking-suggestion files are
          merged and deduped.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{rows.length} lines</CardTitle>
          <CardDescription>
            {inCount} in · {outCount} out · Bank CSV suggestions merged with master workbook{' '}
            <code>{year}_EÜR</code> (workbook lines may lack SKR03 until mapped)
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No transactions for {year}. Run booking suggestions on your PC (
              <code>run_ldw_booking_year.ps1</code>), then{' '}
              <code>sync-bundled-euer-data.ps1</code> and push.
            </p>
          ) : (
            <TransactionsTable rows={rows} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
