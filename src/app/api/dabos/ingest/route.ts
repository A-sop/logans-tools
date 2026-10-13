import { NextResponse } from 'next/server';
import { z } from 'zod';

import { dabosDbUnavailable, jsonError, requireDabosDb } from '@/lib/dabos/api-utils';
import { getDabosSql } from '@/lib/dabos/db';
import { DVAG_KEYWORD_REGEX, ingestCapture } from '@/lib/dabos/ingest';
import { authorizeTier0 } from '@/lib/dabos/tier0-auth';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  mouth: z.enum(['telegram', 'slack', 'buzz', 'api']),
  external_id: z.string().min(1).max(200),
  text: z.string().max(20000).default(''),
  urls: z.array(z.string().min(1).max(2000)).max(50).optional(),
  attachments: z.array(z.string().max(200)).max(50).optional(),
  captured_at: z.string().optional(),
  wiki_bundle: z.string().max(500).optional(),
  department_id: z.string().max(20).optional().nullable(),
  division_id: z.string().max(20).optional().nullable(),
  priority: z.number().int().min(1).max(5).optional(),
  title: z.string().max(120).optional(),
  sha256: z.string().regex(/^[0-9a-fA-F]{64}$/).transform((v) => v.toLowerCase()).optional(),
  store_path: z.string().max(500).optional(),
});

/**
 * Shared ingest — INs POST here (Tier0 / cron / Clerk).
 * Wire field `mouth` = which IN.
 * POST /api/dabos/ingest
 */
export async function POST(request: Request) {
  const denied = await authorizeTier0(request);
  if (denied) return denied;

  if (!requireDabosDb()) return dabosDbUnavailable();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body');
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.errors.map((e) => e.message).join('; '));
  }

  const hasSha256 = Boolean(parsed.data.sha256);
  const hasStorePath = Boolean(parsed.data.store_path);
  if (hasSha256 !== hasStorePath) {
    return jsonError('Both sha256 and store_path must be provided together, or neither', 400);
  }

  const textMatches = DVAG_KEYWORD_REGEX.test(parsed.data.text);
  const urlsMatch = parsed.data.urls?.some((url) => DVAG_KEYWORD_REGEX.test(url)) ?? false;
  if (textMatches || urlsMatch) {
    return jsonError('DVAG keyword detected; capture rejected', 422);
  }

  try {
    const result = await ingestCapture(getDabosSql(), {
      mouth: parsed.data.mouth,
      external_id: parsed.data.external_id,
      text: parsed.data.text,
      urls: parsed.data.urls,
      attachments: parsed.data.attachments,
      captured_at: parsed.data.captured_at,
      wiki_bundle: parsed.data.wiki_bundle,
      department_id: parsed.data.department_id,
      division_id: parsed.data.division_id,
      priority: parsed.data.priority,
      title: parsed.data.title,
      sha256: parsed.data.sha256,
      store_path: parsed.data.store_path,
    });

    return NextResponse.json(
      {
        ok: true,
        ...result,
      },
      { status: result.created ? 201 : 200 }
    );
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 500);
  }
}
