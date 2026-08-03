import { NextResponse } from 'next/server';

import { BOOKMARK_REVIEW_UI_BATCH } from '@/lib/dabos-ops/contact-network/bookmark-review-constants';
import { clampReviewBatch } from '@/lib/dabos-ops/document-intake/review-config';
import { listBookmarkReviewPage } from '@/lib/dabos-ops/contact-network/bookmark-review-service';
import type { BookmarkReviewFilter } from '@/lib/dabos-ops/contact-network/bookmark-review-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FILTERS = new Set<BookmarkReviewFilter>(['todo', 'noted', 'kept', 'all']);

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const rawFilter = searchParams.get('filter') ?? 'todo';
    const filter = FILTERS.has(rawFilter as BookmarkReviewFilter) ? (rawFilter as BookmarkReviewFilter) : 'todo';
    const rawLimit = searchParams.get('limit');
    const limit =
      rawLimit === 'all' || rawLimit === '0' ? null : clampReviewBatch(Number.parseInt(rawLimit ?? String(BOOKMARK_REVIEW_UI_BATCH), 10));
    const offset = Math.max(0, Number.parseInt(searchParams.get('offset') ?? '0', 10) || 0);

    return NextResponse.json(listBookmarkReviewPage(filter, limit, offset));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load bookmark queue';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
