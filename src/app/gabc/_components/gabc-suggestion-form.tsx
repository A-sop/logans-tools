'use client';

import { useActionState } from 'react';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { sendGabcSuggestion } from '@/app/gabc/actions';

type ActionState =
  | { ok: false; error: string; fieldErrors?: Record<string, string | undefined> }
  | { ok: true; message: string };

const initialState: ActionState = { ok: false, error: '' };

export function GabcSuggestionForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_prevState, formData) => sendGabcSuggestion(formData),
    initialState
  );

  const fieldErrors = state.ok ? undefined : state.fieldErrors;

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="name"
          label="Your name"
          description="Optional. Helps us follow up if needed."
          error={fieldErrors?.name}
        >
          <Input id="name" name="name" autoComplete="name" />
        </FormField>

        <FormField
          id="email"
          label="Your email"
          description="Optional. If provided, we can reply."
          error={fieldErrors?.email}
        >
          <Input id="email" name="email" type="email" autoComplete="email" />
        </FormField>
      </div>

      <FormField
        id="suggestion"
        label="Suggestion"
        required
        description="What should change? If possible, include the page/section and your reasoning."
        error={fieldErrors?.suggestion}
      >
        <Textarea id="suggestion" name="suggestion" required minLength={10} />
      </FormField>

      {/* Simple honeypot field (spam) */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="company">Company</label>
        <input id="company" name="company" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 text-sm">
          {state.ok ? (
            <p className="text-primary">{state.message}</p>
          ) : state.error ? (
            <p className="text-destructive" role="alert">
              {state.error}
            </p>
          ) : (
            <p className="text-muted-foreground">
              If you would like me to also work on this with you and I have Asana access, we can
              communicate there.
            </p>
          )}
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Sending…' : 'Send suggestion'}
        </Button>
      </div>
    </form>
  );
}

