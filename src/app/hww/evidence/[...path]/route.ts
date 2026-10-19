import { readFileSync } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { requireDabosAuth } from '@/lib/dabos/clerk-auth';
import { getHwwDataDir, resolveEvidencePath } from '@/lib/hww/paths';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const auth = await requireDabosAuth();
  if ('error' in auth) return auth.error;

  if (!getHwwDataDir()) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const { path: parts } = await ctx.params;
  if (!parts?.length || parts.some((p) => p === '..' || p.includes('\0'))) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const file = resolveEvidencePath(parts);
  if (!file) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const buf = readFileSync(file);
  const ext = path.extname(file).toLowerCase();
  const type =
    ext === '.png'
      ? 'image/png'
      : ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : ext === '.pdf'
          ? 'application/pdf'
          : 'application/octet-stream';

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': type,
      'Cache-Control': 'private, no-store',
    },
  });
}
