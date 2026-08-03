import { NextResponse } from 'next/server';

import {
  applyBookmarkDecision,
  checkBookmarkById,
  saveBookmarkNotes,
} from '@/lib/dabos-ops/contact-network/bookmark-review-service';
import type { BookmarkReviewDecision } from '@/lib/dabos-ops/contact-network/bookmark-review-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DECISIONS = new Set<BookmarkReviewDecision>(['keep', 'delete']);

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as {
      id?: number;
      decision?: string;
      notes?: string;
      deleteFromChrome?: boolean;
      recheckLink?: boolean;
      notesOnly?: boolean;
    };

    if (!body.id || !Number.isFinite(body.id)) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    if (body.notesOnly) {
      const item = await saveBookmarkNotes(body.id, typeof body.notes === 'string' ? body.notes : '');
      if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ item });
    }

    const decision = body.decision as BookmarkReviewDecision;
    if (!DECISIONS.has(decision)) {
      return NextResponse.json({ error: 'Invalid decision â€” use keep or delete' }, { status: 400 });
    }

    const result = await applyBookmarkDecision({
      id: body.id,
      decision,
      notes: typeof body.notes === 'string' ? body.notes : undefined,
      deleteFromChrome: body.deleteFromChrome,
      recheckLink: body.recheckLink,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save bookmark decision';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const id = Number.parseInt(searchParams.get('id') ?? '', 10);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    const item = await checkBookmarkById(id);
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to check bookmark';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
