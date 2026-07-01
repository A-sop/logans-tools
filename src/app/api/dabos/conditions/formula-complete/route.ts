import { NextResponse } from 'next/server';
import { z } from 'zod';

import { dabosDbUnavailable, jsonError, requireDabosDb } from '@/lib/dabos/api-utils';
import { requireDabosAuth } from '@/lib/dabos/clerk-auth';
import { completeFormulaForEntity } from '@/lib/dabos/queries';

const conditionLabel = z.enum([
  'Power Change',
  'Power',
  'Affluence',
  'Normal',
  'Emergency',
  'Danger',
  'Non-Existence',
]);

const formulaStep = z.object({
  step: z.number().int().positive(),
  note: z.string().min(1),
});

const dangerWhyBasis = z.object({
  scope: z.enum(['person', 'post', 'division', 'department', 'project']),
  entity_id: z.string().min(1),
  metric_key: z.string().optional(),
  stat_values: z.array(z.number()).optional(),
  ideal_scene: z.string().optional(),
  situation: z.string().optional(),
  out_points: z.array(z.string()).optional(),
  draft_why: z.string().optional(),
  probable_why: z.string().optional(),
  opens_door_to_handling: z.boolean().optional(),
  surprised: z.boolean().optional(),
  track: z.enum(['org', 'individual']),
  excluded: z.array(z.string()).optional(),
});

const formulaCompleteSchema = z.object({
  entity_type: z.enum(['division', 'department', 'workspace', 'project']),
  entity_id: z.string().min(1),
  condition_label: conditionLabel,
  steps_completed: z.array(formulaStep).min(1),
  probable_why: z.string().optional(),
  danger_why_basis: dangerWhyBasis.optional(),
  attested_by: z.string().optional(),
  verified_by: z.string().optional(),
  advance: z.boolean().optional(),
});

export async function POST(request: Request) {
  const authResult = await requireDabosAuth();
  if ('error' in authResult) return authResult.error;

  if (!requireDabosDb()) return dabosDbUnavailable();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body');
  }

  const parsed = formulaCompleteSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.errors.map((e) => e.message).join('; '));
  }

  const result = await completeFormulaForEntity(parsed.data);
  return NextResponse.json(result);
}
