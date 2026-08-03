import { NextResponse } from 'next/server';
import { z } from 'zod';

import { dabosDbUnavailable, jsonError, requireDabosDb } from '@/lib/dabos/api-utils';
import { requireDabosAuth } from '@/lib/dabos/clerk-auth';
import { authorizeDabosCron } from '@/lib/dabos/cron-auth';
import { refreshAllConditionsFromBoardWithSql } from '@/lib/dabos/board-conditions-query';
import { createDabosSql } from '@/lib/dabos/dabos-connection';
import { getDabosSql } from '@/lib/dabos/db';
import { emitShippedOutputsFromShipLog } from '@/lib/dabos/ship-gate-emit';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  ship_row: z.number().int().positive().optional(),
  refresh_conditions: z.boolean().optional(),
});

function isCronAuthorized(request: Request): boolean {
  return authorizeDabosCron(request) === null;
}

/** POST — Dept13 PASS → Div4 shipped_outputs emit (ideal Layer A ship-gate). */
export async function POST(request: Request) {
  if (!isCronAuthorized(request)) {
    const authResult = await requireDabosAuth();
    if ('error' in authResult) return authResult.error;
  }

  if (!requireDabosDb()) return dabosDbUnavailable();

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text.trim()) body = JSON.parse(text);
  } catch {
    return jsonError('Invalid JSON body');
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.errors.map((e) => e.message).join('; '));
  }

  const url = process.env.DATABASE_URL?.trim();
  const sql = url ? createDabosSql(url) : getDabosSql();

  const emit = await emitShippedOutputsFromShipLog({
    dabosSql: sql,
    shipRow: parsed.data.ship_row,
  });

  let conditionsRefreshed = false;
  if (parsed.data.refresh_conditions !== false) {
    try {
      await refreshAllConditionsFromBoardWithSql(sql);
      conditionsRefreshed = true;
    } catch {
      conditionsRefreshed = false;
    }
  }

  if (url && 'end' in sql && typeof sql.end === 'function') {
    await sql.end({ timeout: 5 });
  }

  return NextResponse.json({
    ok: true,
    job: 'ship_gate',
    ...emit,
    conditions_refreshed: conditionsRefreshed,
  });
}
