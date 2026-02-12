import { z } from 'zod';

const LOCALES = ['en', 'de'] as const;

/** Schema for early access form. Enforces type, length, trim. */
export const earlyAccessSchema = z.object({
  email: z
    .string()
    .transform((s) => s.trim())
    .pipe(
      z
        .string({ required_error: 'email_required' })
        .min(1, 'email_required')
        .max(254, 'email_too_long')
        .email('email_invalid')
    ),
  locale: z
    .string()
    .trim()
    .refine((s) => LOCALES.includes(s as (typeof LOCALES)[number]), {
      message: 'locale_invalid',
    })
    .transform((s) => s as (typeof LOCALES)[number]),
});

export type EarlyAccessInput = z.infer<typeof earlyAccessSchema>;

/** Parse FormData into validated input. Returns success or error key for i18n. */
export function parseEarlyAccessFormData(
  formData: FormData
): { success: true; data: EarlyAccessInput } | { success: false; errorKey: string } {
  const raw = {
    email: (formData.get('email') as string) ?? '',
    locale: (formData.get('locale') as string) ?? 'en',
  };

  const result = earlyAccessSchema.safeParse(raw);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const first = result.error.errors[0];
  const msg = first?.message ?? 'email_required';
  return { success: false, errorKey: String(msg) };
}

/** Client-side schema for email-only validation (e.g. disable submit). */
export const emailOnlySchema = earlyAccessSchema.pick({ email: true });
