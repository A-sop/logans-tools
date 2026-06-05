import { NextResponse } from 'next/server';

import { dabosDbUnavailable, requireDabosDb } from '@/lib/dabos/api-utils';
import { requireDabosAuth } from '@/lib/dabos/clerk-auth';
import { getDabosSql } from '@/lib/dabos/db';
import {
  countOpenTasks,
  evaluateAndPersistCondition,
  getLatestCondition,
  getLatestStatValue,
} from '@/lib/dabos/queries';

export async function GET() {
  const authResult = await requireDabosAuth();
  if ('error' in authResult) return authResult.error;

  if (!requireDabosDb()) return dabosDbUnavailable();

  const sql = getDabosSql();
  const divisions = await sql`
    SELECT id, operational_name, description, primary_metric_key, created_at
    FROM divisions
    ORDER BY id
  `;

  const enriched = await Promise.all(
    divisions.map(async (div) => {
      const metricKey = (div.primary_metric_key as string | null) ?? 'tasks_completed';
      let condition = null;
      if (metricKey) {
        condition = await evaluateAndPersistCondition({
          entity_type: 'division',
          entity_id: div.id as string,
          metric_key: metricKey,
          window_days: 7,
        });
      } else {
        const latest = await getLatestCondition('division', div.id as string);
        if (latest) {
          condition = {
            condition: latest.condition,
            confidence: latest.confidence,
            point_count: null,
            basis: latest.basis,
          };
        }
      }

      const latestStat = metricKey
        ? await getLatestStatValue(div.id as string, metricKey)
        : null;
      const openTasks = await countOpenTasks(div.id as string);

      return {
        ...div,
        latest_condition: condition,
        primary_stat: latestStat
          ? { metric_key: metricKey, value: latestStat.value, recorded_at: latestStat.recorded_at }
          : null,
        activity: openTasks > 0 ? 'active' : 'idle',
        open_task_count: openTasks,
      };
    })
  );

  return NextResponse.json({ divisions: enriched });
}
