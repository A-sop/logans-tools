import { NextResponse } from 'next/server';

import { hasDabosDb } from '@/lib/dabos/db';

export function dabosDbUnavailable() {
  return NextResponse.json(
    {
      error: 'DABOS database not configured',
      hint: 'Set DATABASE_URL in .env.local and run npm run dabos:migrate',
    },
    { status: 503 }
  );
}

export function requireDabosDb(): boolean {
  return hasDabosDb();
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
