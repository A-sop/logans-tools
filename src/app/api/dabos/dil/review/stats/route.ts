import { NextResponse } from 'next/server';

import { getReviewStats } from '@/lib/dabos-ops/document-intake/review-service';



export const runtime = 'nodejs';

export const dynamic = 'force-dynamic';



export async function GET(request: Request): Promise<NextResponse> {

  try {

    const { searchParams } = new URL(request.url);

    const includeInboxWalk = searchParams.get('full') === '1';

    return NextResponse.json(await getReviewStats({ includeInboxWalk }));

  } catch (error: unknown) {

    const message = error instanceof Error ? error.message : 'Failed to load review stats';

    return NextResponse.json({ error: message }, { status: 500 });

  }

}
