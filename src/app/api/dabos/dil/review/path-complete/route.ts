import { NextResponse } from 'next/server';
import { completeDataPath } from '@/lib/dabos-ops/document-intake/path-complete';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') ?? '';
    const result = completeDataPath(q);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Path completion failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
