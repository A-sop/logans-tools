import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { isHwwClerkUserAllowed } from '@/lib/hww/auth';
import { resolveHwwRecords, resolveHwwSummary } from '@/lib/hww/load';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  if (!isHwwClerkUserAllowed(userId)) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const summary = await resolveHwwSummary();
  if (!summary) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const url = new URL(request.url);
  const stat = url.searchParams.get('stat') ?? undefined;
  const week = url.searchParams.get('week') ?? undefined;
  const area = url.searchParams.get('area') ?? undefined;
  const kind = url.searchParams.get('kind') ?? undefined;

  let rows = await resolveHwwRecords(summary);
  if (stat) rows = rows.filter((r) => r.stat === stat);
  if (week) rows = rows.filter((r) => r.stat_week === week);
  if (area) rows = rows.filter((r) => r.area === area);
  if (kind) rows = rows.filter((r) => r.kind === kind);

  const header = ['stat', 'date', 'stat_week', 'value', 'unit', 'area', 'kind', 'source_file', 'source_key'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.stat,
        r.date,
        r.stat_week ?? '',
        r.value ?? '',
        r.unit ?? '',
        r.area ?? '',
        r.kind ?? '',
        r.source_file,
        r.source_key,
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(','),
    );
  }

  return new NextResponse(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="hww-export.csv"',
      'Cache-Control': 'private, no-store',
    },
  });
}
