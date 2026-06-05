import { clerkClient } from '@clerk/nextjs/server';
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const DEFAULT_ALLOWED_EMAIL = 'logan.d.williams@gmail.com';

function parseAllowedEmails(): string[] {
  const raw = process.env.DABOS_ALLOWED_EMAILS?.trim();
  const source = raw && raw.length > 0 ? raw : DEFAULT_ALLOWED_EMAIL;
  return source
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function getDabosAllowedEmails(): string[] {
  return parseAllowedEmails();
}

export async function getPrimaryEmailForUser(userId: string): Promise<string | null> {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const primary = user.emailAddresses.find((entry) => entry.id === user.primaryEmailAddressId);
  const email = (primary ?? user.emailAddresses[0])?.emailAddress?.trim().toLowerCase();
  return email ?? null;
}

export async function isDabosEmailAllowlisted(userId: string): Promise<boolean> {
  const email = await getPrimaryEmailForUser(userId);
  if (!email) return false;
  return getDabosAllowedEmails().includes(email);
}

export async function requireDabosAuth(): Promise<
  { userId: string } | { error: NextResponse }
> {
  const { userId } = await auth();
  if (!userId) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const allowed = await isDabosEmailAllowlisted(userId);
  if (!allowed) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { userId };
}

export function dabosAccessDeniedPage(requestUrl: string): NextResponse {
  const url = new URL('/sign-in', requestUrl);
  url.searchParams.set('error', 'access_denied');
  return NextResponse.redirect(url);
}
