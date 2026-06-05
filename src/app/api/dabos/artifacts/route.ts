import { NextResponse } from 'next/server';
import { z } from 'zod';

import { dabosDbUnavailable, jsonError, requireDabosDb } from '@/lib/dabos/api-utils';
import { getDabosSql } from '@/lib/dabos/db';

const createArtifactSchema = z.object({
  division_id: z.string().optional().nullable(),
  department_id: z.string().optional().nullable(),
  task_id: z.string().uuid().optional().nullable(),
  type: z.string().min(1).optional(),
  summary: z.string().min(1),
  storage_uri: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  created_by: z.string().optional(),
});

export async function POST(request: Request) {
  if (!requireDabosDb()) return dabosDbUnavailable();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body');
  }

  const parsed = createArtifactSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.errors.map((e) => e.message).join('; '));
  }

  const input = parsed.data;
  const sql = getDabosSql();

  const rows = await sql`
    INSERT INTO artifacts (
      division_id, department_id, task_id, type, summary, storage_uri, tags, created_by
    ) VALUES (
      ${input.division_id ?? null},
      ${input.department_id ?? null},
      ${input.task_id ?? null},
      ${input.type ?? 'document'},
      ${input.summary},
      ${input.storage_uri ?? null},
      ${JSON.stringify(input.tags ?? [])}::jsonb,
      ${input.created_by ?? 'human'}
    )
    RETURNING *
  `;

  return NextResponse.json({ artifact: rows[0] }, { status: 201 });
}
