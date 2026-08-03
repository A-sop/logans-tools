import { StatusDashboard } from '@/components/atlas-ops/status-dashboard';
import { getAtlasDashboardData } from '@/lib/atlas-ops/status-dashboard';

export const metadata = {
  title: 'Office status — DABOS',
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
