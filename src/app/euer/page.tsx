import Link from 'next/link';
import { Suspense } from 'react';
import { YearSelect } from '@/components/euer/year-select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getAvailableYears,
  getEurSummary,
  getTransactionRows,
  getPaths,
} from '@/lib/ldw-data';
import { formatEur } from '@/lib/utils';

type PageProps = { searchParams: Promise<{ year?: string }> };

export default async function EuerDashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const years = getAvailableYears();
  const year = params.year ? Number(params.year) : years[0] ?? 2024;
  const summary = getEurSummary(year);
  const transactions = getTransactionRows(year);
  const inbox = transactions.filter((r) => r.needsReview);
  const totalExpenses = summary.reduce((sum, row) => sum + row.totalNettoAg, 0);
  const paths = getPaths();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            EÜR cockpit — bank CSVs and master workbook (no Zoho).
          </p>
        </div>
        <Suspense fallback={<span className="text-sm text-muted-foreground">Year…</span>}>
          <YearSelect years={years} currentYear={year} />
        </Suspense>
      </div>

      {paths.dataSource === 'bundled' ? (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Showing bundled summaries from the repo. Full inbox/ledger on your PC uses{' '}
          <code className="text-foreground">C:\DATA\20_ADMIN</code> when running locally.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Ausgaben (Zeilen)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{formatEur(totalExpenses)}</p>
            <p className="text-xs text-muted-foreground">{summary.length} EÜR Zeilen</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Inbox</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{inbox.length}</p>
            <Link href={`/euer/inbox?year=${year}`} className="text-xs text-primary hover:underline">
              Review queue
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{transactions.length}</p>
            <Link href={`/euer/ledger?year=${year}`} className="text-xs text-primary hover:underline">
              In / out with SKR03 + EÜR
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>EÜR summary {year}</CardTitle>
          <CardDescription>Totals per official Anlage EÜR Zeile</CardDescription>
        </CardHeader>
        <CardContent>
          {summary.length === 0 ? (
            <p className="text-sm text-muted-foreground">No summary data for {year} yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Zeile</th>
                    <th className="pb-2 pr-4">Label</th>
                    <th className="pb-2 pr-4 text-right">Netto AG</th>
                    <th className="pb-2 text-right">Rows</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((row) => (
                    <tr key={row.zeile} className="border-b border-border/60">
                      <td className="py-2 pr-4 font-medium">{row.zeile}</td>
                      <td className="max-w-md truncate py-2 pr-4">{row.label}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{formatEur(row.totalNettoAg)}</td>
                      <td className="py-2 text-right tabular-nums">{row.rowCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
