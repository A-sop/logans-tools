'use server';

import nodemailer from 'nodemailer';
import { z } from 'zod';

const schema = z.object({
  name: z.string().trim().max(120).optional().or(z.literal('')),
  email: z
    .string()
    .trim()
    .max(254)
    .email('Please enter a valid email address.')
    .optional()
    .or(z.literal('')),
  suggestion: z
    .string()
    .trim()
    .min(10, 'Please include a bit more detail (min 10 characters).')
    .max(6000, 'Please keep suggestions under 6000 characters.'),
  // Honeypot
  company: z.string().optional().or(z.literal('')),
});

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const portRaw = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SUGGESTIONS_FROM_EMAIL;
  const to = process.env.SUGGESTIONS_TO_EMAIL ?? 'logan.williams@gabc.eu';

  if (!host || !portRaw || !user || !pass || !from) {
    return { ok: false as const, error: 'Missing SMTP env vars.' };
  }

  const port = Number(portRaw);
  if (!Number.isFinite(port) || port <= 0) {
    return { ok: false as const, error: 'Invalid SMTP_PORT.' };
  }

  return {
    ok: true as const,
    host,
    port,
    user,
    pass,
    from,
    to,
  };
}

export async function sendGabcSuggestion(
  formData: FormData
): Promise<{ ok: true; message: string } | { ok: false; error: string; fieldErrors?: Record<string, string> }> {
  const parsed = schema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    suggestion: formData.get('suggestion'),
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

  // Honeypot: if filled, pretend success to avoid feedback loops for bots.
  if (parsed.data.company && parsed.data.company.trim().length > 0) {
    return { ok: true, message: 'Thanks — received.' };
  }

  const smtp = getSmtpConfig();
  if (!smtp.ok) {
    return {
      ok: false,
      error:
        'Email sending is not configured yet. Add SMTP env vars on the deployment, then try again.',
    };
  }

  const name = parsed.data.name?.trim() ? parsed.data.name.trim() : 'Anonymous';
  const email = parsed.data.email?.trim() ? parsed.data.email.trim() : undefined;
  const suggestion = parsed.data.suggestion.trim();

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: { user: smtp.user, pass: smtp.pass },
  });

  const subject = `GABC suggestion${email ? ` from ${email}` : ''}`;
  const text = [
    'New suggestion submitted from gabc.logans.tools PRD page',
    '',
    `Name: ${name}`,
    `Email: ${email ?? '(not provided)'}`,
    '',
    'Suggestion:',
    suggestion,
  ].join('\n');

  await transporter.sendMail({
    from: smtp.from,
    to: smtp.to,
    replyTo: email ? `${name} <${email}>` : undefined,
    subject,
    text,
  });

  return { ok: true, message: 'Sent. Thank you for the feedback.' };
}

