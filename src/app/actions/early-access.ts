'use server';

import { parseEarlyAccessFormData } from '@/lib/schemas/early-access';
import { t } from '@/lib/i18n';

export type EarlyAccessResult =
  | { success: true; message: string }
  | { success: false; error: string };

/** Server action: submit early access email. Validates with Zod. */
export async function submitEarlyAccess(
  _prevState: unknown,
  formData: FormData
): Promise<EarlyAccessResult> {
  try {
    const parsed = parseEarlyAccessFormData(formData);
    if (!parsed.success) {
      const locale = ((formData.get('locale') as string) ?? 'en').trim();
      const safeLocale = locale === 'de' ? 'de' : 'en';
      return {
        success: false,
        error: t(safeLocale, `validation.${parsed.errorKey}`),
      };
    }

    const { email, locale } = parsed.data;

    // Simulate async work; in future, persist to DB with parameterized query
    await new Promise((r) => setTimeout(r, 500));

    return {
      success: true,
      message: t(locale, 'earlyAccessSuccess', { email }),
    };
  } catch (err) {
    console.error('[submitEarlyAccess] Unexpected error:', err);
    return {
      success: false,
      error: 'Something went wrong. Please try again.',
    };
  }
}
