'use client';

import { useActionState } from 'react';

import { grantEuerAccess } from '@/app/euer-access/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';

type ActionState =
  | { ok: false; error: string; fieldErrors?: Record<string, string | undefined> }
  | { ok: true; nextPath: string };

const initialState: ActionState = { ok: false, error: '' };

export default function EuerAccessPage({ searchParams }: { searchParams?: { next?: string } }) {
  const next = searchParams?.next ?? '/euer';

  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (_prev, fd) => {
    const res = await grantEuerAccess(fd);
    if (res.ok) {
      window.location.href = res.nextPath;
      return res;
    }
    return res;
  }, initialState);

  const fieldErrors = state.ok ? undefined : state.fieldErrors;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-xl items-center px-4 py-10">
      <Card className="w-full rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold leading-tight">LDW Books (EÜR)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Private bookkeeping cockpit. Sign in with your <span className="font-medium">inbox@loganwilliams.com</span>{' '}
            address to continue.
          </p>

          <form action={formAction} className="space-y-4">
            <input type="hidden" name="next" value={next} />

            <FormField id="email" label="Email" required error={fieldErrors?.email}>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="inbox@loganwilliams.com"
                required
              />
            </FormField>

            <div className="hidden" aria-hidden="true">
              <label htmlFor="company">Company</label>
              <input id="company" name="company" tabIndex={-1} autoComplete="off" />
            </div>

            {!state.ok && state.error ? (
              <p className="text-sm text-destructive" role="alert">
                {state.error}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? 'Checking…' : 'Continue'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
