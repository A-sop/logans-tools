import * as React from 'react';

import { cn } from '@/lib/utils';

export interface ErrorMessageProps extends React.HTMLAttributes<HTMLParagraphElement> {
  message: string | null | undefined;
}

/**
 * Inline error message following design system.
 * Use below form fields or after failed actions.
 * Renders nothing when message is null/undefined/empty.
 */
export function ErrorMessage({ message, className, ...props }: ErrorMessageProps) {
  if (!message?.trim()) return null;

  return (
    <p
      role="alert"
      className={cn('text-sm text-destructive', className)}
      {...props}
    >
      {message}
    </p>
  );
}
