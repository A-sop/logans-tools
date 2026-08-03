import { NextResponse } from 'next/server';

import { clampClassifyBatch, DIL_REVIEW_UI_BATCH } from '@/lib/atlas-ops/document-intake/review-config';

import { processInboxBatch } from '@/lib/atlas-ops/document-intake/review-service';



export const runtime = 'nodejs';

export const dynamic = 'force-dynamic';

export const maxDuration = 300;



export async function POST(request: Request): Promise<NextResponse> {

  try {

    const body = (await request.json().catch(() => ({}))) as { limit?: number };

    const limit = clampClassifyBatch(typeof body.limit === 'number' ? body.limit : DIL_REVIEW_UI_BATCH);

    const result = await processInboxBatch(limit);

    return NextResponse.json(result);

  } catch (error: unknown) {

    const message = error instanceof Error ? error.message : 'Failed to classify inbox batch';

    return NextResponse.json({ error: message }, { status: 500 });

  }

}
