import { ConditionsHistory } from '@/components/dabos/conditions-history';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchAllTimeStatsBundle } from '@/lib/dabos/all-time-stats';
import { getDabosSql } from '@/lib/dabos/db';
import { dabosConfigured } from '@/lib/dabos/server-data';

export const dynamic = 'force-dynamic';

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
        Conditions history needs Neon <code>stats</code> + <code>entity_condition_state</code>.
      </CardContent>
    </Card>
  );
}

export default async function DabosConditionsHistoryPage() {
  if (!dabosConfigured()) {
    return <SetupPanel />;
  }

  const bundle = await fetchAllTimeStatsBundle(getDabosSql());
  return <ConditionsHistory bundle={bundle} />;
}
