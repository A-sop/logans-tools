import * as React from 'react';

import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { ErrorMessage } from '@/components/ui/error-message';

export interface FormFieldProps {
  /** Input id for label association */
  id?: string;
  label: React.ReactNode;
  /** Optional description below label */
  description?: React.ReactNode;
  /** Error message (renders below input) */
  error?: string | null;
  /** Required indicator */
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Wraps a form control with label, optional description, and error.
 * Follows design system: space-y-2, text-sm, text-muted-foreground.
 */
export function FormField({
  id,
  label,
  description,
  error,
  required,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id} className={required ? "after:ml-0.5 after:text-destructive after:content-['*']" : undefined}>
        {label}
      </Label>
      {description && (
        <p id={id ? `${id}-desc` : undefined} className="text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {children}
      <ErrorMessage message={error} id={id ? `${id}-error` : undefined} />
    </div>
  );
}
