'use server';

import { cookies } from 'next/headers';
import { z } from 'zod';

const PREVIEW_COOKIE_NAME = 'euer_preview';

const schema = z.object({
  email: z
    .string()
    .trim()
    .min(5, 'Please enter your email address.')
    .max(254, 'Please enter a valid email address.')
    .email('Please enter a valid email address.'),
  next: z.string().optional().or(z.literal('')),
  company: z.string().optional().or(z.literal('')),
});

function isAllowedEmail(email: string) {
  const normalized = email.toLowerCase();
  return (
    normalized === 'inbox@loganwilliams.com' || normalized.endsWith('@loganwilliams.com')
  );
}

export async function grantEuerAccess(formData: FormData): Promise<
  | { ok: true; nextPath: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
> {
  const parsed = schema.safeParse({
    email: formData.get('email'),
    next: formData.get('next'),
    company: formData.get('company'),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form');
      fieldErrors[key] = issue.message;
    }
    return { ok: false, error: 'Please fix the form errors and try again.', fieldErrors };
  }

  if (parsed.data.company && parsed.data.company.trim().length > 0) {
    return { ok: true, nextPath: '/euer' };
  }

  if (!isAllowedEmail(parsed.data.email)) {
    return {
      ok: false,
      error: 'Access is limited to your loganwilliams.com inbox.',
      fieldErrors: { email: 'Use inbox@loganwilliams.com (or your @loganwilliams.com address).' },
    };
  }

  const nextPath =
    parsed.data.next && parsed.data.next.startsWith('/euer') && !parsed.data.next.startsWith('//')
      ? parsed.data.next
      : '/euer';

  const cookieStore = await cookies();
  cookieStore.set(PREVIEW_COOKIE_NAME, '1', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return { ok: true, nextPath };
}
