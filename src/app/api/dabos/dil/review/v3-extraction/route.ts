import { NextResponse } from 'next/server';
import { getPilotV3Extraction, getPilotV3Meta } from '@/lib/dabos-ops/document-intake/pilot-v3-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const sourcePath = searchParams.get('path');

    if (!sourcePath) {
      const meta = await getPilotV3Meta();
      return NextResponse.json(meta);
    }

    const extraction = await getPilotV3Extraction(sourcePath);
    if (!extraction) {
      return NextResponse.json({ extraction: null });
    }

    return NextResponse.json({ extraction });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load v3 extraction';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
