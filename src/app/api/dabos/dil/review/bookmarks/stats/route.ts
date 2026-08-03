import { NextResponse } from 'next/server';

import { getBookmarkReviewStats } from '@/lib/dabos-ops/contact-network/bookmark-review-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json(getBookmarkReviewStats());
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load bookmark stats';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
