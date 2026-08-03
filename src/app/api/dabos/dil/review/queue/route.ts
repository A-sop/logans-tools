import { NextResponse } from 'next/server';

import type { ReviewQueueFilter } from '@/lib/atlas-ops/document-intake/review-types';

import { DIL_REVIEW_UI_BATCH, clampReviewBatch } from '@/lib/atlas-ops/document-intake/review-config';

import { listReviewQueuePage } from '@/lib/atlas-ops/document-intake/review-service';



export const runtime = 'nodejs';

export const dynamic = 'force-dynamic';



const FILTERS = new Set<ReviewQueueFilter>(['todo', 'admin', 'later', 'noted', 'decided', 'all']);



export async function GET(request: Request): Promise<NextResponse> {

  try {

    const { searchParams } = new URL(request.url);

    const rawFilter = searchParams.get('filter') ?? 'todo';

    const filter = FILTERS.has(rawFilter as ReviewQueueFilter) ? (rawFilter as ReviewQueueFilter) : 'todo';



    const rawLimit = searchParams.get('limit');

    let limit: number | null = null;

    if (rawLimit === 'all' || rawLimit === '0') {

      limit = null;

    } else if (rawLimit) {

      limit = clampReviewBatch(Number.parseInt(rawLimit, 10));

    } else if (filter === 'todo' || filter === 'admin' || filter === 'noted') {

      limit = DIL_REVIEW_UI_BATCH;

    }



    const offset = Math.max(0, Number.parseInt(searchParams.get('offset') ?? '0', 10) || 0);



    return NextResponse.json(listReviewQueuePage(filter, limit, offset));

  } catch (error: unknown) {

    const message = error instanceof Error ? error.message : 'Failed to load review queue';

    return NextResponse.json({ error: message }, { status: 500 });

  }

}
