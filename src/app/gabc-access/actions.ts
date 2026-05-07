'use server';

import { cookies } from 'next/headers';
import { z } from 'zod';

const PREVIEW_COOKIE_NAME = 'gabc_preview';

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
  return email.toLowerCase().endsWith('@gabc.eu');
}

export async function grantPreviewAccess(formData: FormData): Promise<
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

  // Honeypot: if filled, pretend success to avoid bot iteration.
  if (parsed.data.company && parsed.data.company.trim().length > 0) {
    return { ok: true, nextPath: '/gabc' };
  }

  if (!isAllowedEmail(parsed.data.email)) {
    return {
      ok: false,
      error: 'This preview is limited to @gabc.eu email addresses.',
      fieldErrors: { email: 'Use your @gabc.eu email address.' },
    };
  }

  const nextPath =
    parsed.data.next && parsed.data.next.startsWith('/') && !parsed.data.next.startsWith('//')
      ? parsed.data.next
      : '/gabc';

  const cookieStore = await cookies();
  cookieStore.set(PREVIEW_COOKIE_NAME, '1', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 14, // 14 days
  });

  return { ok: true, nextPath };
}

