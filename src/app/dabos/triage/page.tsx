import { DailyTriageHub } from '@/components/atlas-ops/daily-triage-hub';
import { getDailyTriageData } from '@/lib/atlas-ops/daily-triage-status';

export const metadata = {
  title: 'Daily triage — DABOS',
  description: 'Human review queue for DATA inbox and Telegram captures',
};

export const dynamic = 'force-dynamic';

export default function DabosTriagePage() {
  const data = getDailyTriageData();
  return (
    <main className="min-h-screen bg-background">
      <DailyTriageHub data={data} />
    </main>
  );
}
