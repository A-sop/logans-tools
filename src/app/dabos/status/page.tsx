import { StatusDashboard } from '@/components/dabos-ops/status-dashboard';
import { getAtlasDashboardData } from '@/lib/dabos-ops/status-dashboard';

export const metadata = {
  title: 'Office status â€” DABOS',
  description: 'Office of LDW status dashboard (former Atlas home)',
};

export const dynamic = 'force-dynamic';

export default async function DabosStatusPage() {
  const data = await getAtlasDashboardData();
  return (
    <main className="min-h-screen bg-background">
      <StatusDashboard data={data} />
    </main>
  );
}
