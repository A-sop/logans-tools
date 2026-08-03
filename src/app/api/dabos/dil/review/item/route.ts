import { NextResponse } from 'next/server';
import { getReviewItem } from '@/lib/atlas-ops/document-intake/review-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const sourcePath = searchParams.get('path');
    if (!sourcePath) {
      return NextResponse.json({ error: 'Missing path query parameter' }, { status: 400 });
    }

    const item = getReviewItem(sourcePath);
    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load review item';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
