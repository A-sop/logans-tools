import { OrgBoard } from '@/components/dabos/org-board/org-board';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BOARD_STAT_YEAR,
  clampCalendarWeek,
  currentCalendarWeek,
  weeksInYear,
} from '@/lib/dabos/calendar-week';
import { dabosConfigured, fetchOrgBoardData } from '@/lib/dabos/server-data';

function SetupPanel() {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle>Database not configured</CardTitle>
        <CardDescription>
          Add <code>DATABASE_URL</code> to <code>.env.local</code>, then run{' '}
          <code>npm run dabos:migrate</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Homelab: <code>Atlas/docs/admin/dabos-ln02-homelab-setup.md</code>
      </CardContent>
    </Card>
  );
}

type PageProps = {
  searchParams: Promise<{ year?: string; cw?: string; period?: string }>;
};

export default async function DabosOrgMapPage({ searchParams }: PageProps) {
  if (!dabosConfigured()) {
    return <SetupPanel />;
  }

  const params = await searchParams;
  const year = params.year ? Number(params.year) : BOARD_STAT_YEAR;
  const statYear = Number.isFinite(year) ? Math.floor(year) : BOARD_STAT_YEAR;
  const cwRaw = params.cw ? Number(params.cw) : currentCalendarWeek(statYear);
  const calendarWeek = clampCalendarWeek(statYear, cwRaw);

  const board = await fetchOrgBoardData({
    year: statYear,
    calendarWeek,
    period: params.period,
  });

  return (
    <OrgBoard
      divisions={board.divisions}
      week={board.week}
      period={board.period}
      executive={board.executive}
      cadence={board.cadence}
      maxWeek={weeksInYear(statYear)}
    />
  );
}
