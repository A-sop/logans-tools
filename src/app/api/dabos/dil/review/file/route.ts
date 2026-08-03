import * as fs from 'fs/promises';
import { NextResponse } from 'next/server';
import { resolveAllowedDataFile } from '@/lib/atlas-ops/document-intake/review-path-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const requestedPath = searchParams.get('path');
    if (!requestedPath) {
      return NextResponse.json({ error: 'Missing path query parameter' }, { status: 400 });
    }

    const allowed = resolveAllowedDataFile(requestedPath);
    if (!allowed) {
      return NextResponse.json({ error: 'File not allowed' }, { status: 403 });
    }

    const data = await fs.readFile(allowed.absolutePath);
    return new NextResponse(data, {
      headers: {
        'Content-Type': allowed.mimeType,
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to read file';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
