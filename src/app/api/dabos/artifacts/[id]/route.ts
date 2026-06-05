import { NextResponse } from 'next/server';

import { dabosDbUnavailable, jsonError, requireDabosDb } from '@/lib/dabos/api-utils';
import { getDabosSql } from '@/lib/dabos/db';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  if (!requireDabosDb()) return dabosDbUnavailable();

  const { id } = await context.params;
  const sql = getDabosSql();

  const rows = await sql`SELECT * FROM artifacts WHERE id = ${id}::uuid`;
  const artifact = rows[0];
  if (!artifact) return jsonError('Artifact not found', 404);

  return NextResponse.json({ artifact });
}
