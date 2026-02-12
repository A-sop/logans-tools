'use client';

import { useActionState, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { submitEarlyAccess } from '@/app/actions/early-access';
import { useLocale } from '@/components/providers/locale-provider';
import { emailOnlySchema } from '@/lib/schemas/early-access';

const initialState = null as
  | { success: true; message: string }
  | { success: false; error: string }
  | null;

export function EarlyAccessForm() {
  const { locale, t } = useLocale();
  const [state, formAction, isPending] = useActionState(submitEarlyAccess, initialState);
  const [email, setEmail] = useState('');
  const [clientError, setClientError] = useState<string | null>(null);

  const validateEmail = useCallback((value: string) => {
    const result = emailOnlySchema.safeParse({ email: value });
    if (result.success) {
      setClientError(null);
      return true;
    }
    const err = result.error.errors[0];
    setClientError(err?.message ?? 'email_required');
    return false;
  }, []);

  const handleBlur = useCallback(() => {
    if (email) validateEmail(email);
  }, [email, validateEmail]);

  const isInvalid = !!clientError;
  const showError =
    state && !state.success ? state.error : clientError ? t(`validation.${clientError}`) : null;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <div className="space-y-2">
        <label
          htmlFor="email"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {t('emailAddress')}
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (clientError) validateEmail(e.target.value);
          }}
          onBlur={handleBlur}
          placeholder={t('emailPlaceholder')}
          className="w-full"
          aria-label={t('emailAriaLabel')}
          aria-describedby="form-feedback"
          aria-invalid={isInvalid || (state && !state.success) ? true : undefined}
          disabled={isPending}
        />
      </div>
      <div id="form-feedback" role="status" aria-live="polite" className="min-h-[1.5rem]">
        {state?.success && (
          <p className="text-sm font-medium text-green-600 dark:text-green-400">{state.message}</p>
        )}
        {showError && <p className="text-sm font-medium text-destructive">{showError}</p>}
      </div>
      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={isPending || !email.trim() || isInvalid}
        aria-busy={isPending}
      >
        {isPending ? t('submitting') : t('notifyMe')}
      </Button>
      <p className="text-center text-xs text-muted-foreground">{t('privacyNote')}</p>
    </form>
  );
}
