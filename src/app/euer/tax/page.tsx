import { Suspense } from 'react';
import { YearSelect } from '@/components/euer/year-select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getAvailableYears, getEurSummary } from '@/lib/ldw-data';
import { formatEur } from '@/lib/utils';

type PageProps = { searchParams: Promise<{ year?: string }> };

export default async function EuerTaxPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const years = getAvailableYears();
  const year = params.year ? Number(params.year) : years[0] ?? 2024;
  const summary = getEurSummary(year);
  const total = summary.reduce((s, r) => s + r.totalNettoAg, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tax (EÜR)</h1>
          <p className="text-sm text-muted-foreground">Totals per official Anlage EÜR Zeile.</p>
        </div>
        <Suspense fallback={null}>
          <YearSelect years={years} currentYear={year} />
        </Suspense>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {year} — Betriebsausgaben · {formatEur(total)}
          </CardTitle>
          <CardDescription>From master workbook summarize</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {summary.map((row) => {
            const pct = total > 0 ? (row.totalNettoAg / total) * 100 : 0;
            return (
              <div key={row.zeile} className="space-y-1">
                <div className="flex justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{row.zeile}</span>
                    <span className="ml-2 text-muted-foreground">{row.label}</span>
                  </span>
                  <span className="shrink-0 tabular-nums font-medium">{formatEur(row.totalNettoAg)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
