import { NextResponse } from 'next/server';
import type { ReviewApproval } from '@/lib/dabos-ops/document-intake/review-types';
import { saveReviewDecision } from '@/lib/dabos-ops/document-intake/review-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const APPROVALS = new Set<ReviewApproval>(['pending', 'Y', 'N', 'L', 'flag']);

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as {
      sourcePath?: string;
      approved?: string;
      reviewNotes?: string;
      keepFilename?: boolean;
      basenameOverride?: string;
      relativePathOverride?: string;
    };

    if (!body.sourcePath || typeof body.sourcePath !== 'string') {
      return NextResponse.json({ error: 'sourcePath is required' }, { status: 400 });
    }

    const approved = (body.approved ?? 'pending') as ReviewApproval;
    if (!APPROVALS.has(approved)) {
      return NextResponse.json({ error: 'Invalid approved value' }, { status: 400 });
    }

    const item = saveReviewDecision({
      sourcePath: body.sourcePath,
      approved,
      reviewNotes: typeof body.reviewNotes === 'string' ? body.reviewNotes : '',
      keepFilename: typeof body.keepFilename === 'boolean' ? body.keepFilename : undefined,
      basenameOverride: typeof body.basenameOverride === 'string' ? body.basenameOverride : undefined,
      relativePathOverride: typeof body.relativePathOverride === 'string' ? body.relativePathOverride : undefined,
    });

    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save decision';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
