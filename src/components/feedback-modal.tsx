'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { feedbackSchema, type FeedbackFormData } from '@/lib/schemas/feedback';
import { submitFeedback } from '@/app/actions/feedback';

const FeedbackModalContext = createContext<{
  open: boolean;
  setOpen: (_open: boolean) => void;
} | null>(null);

function useFeedbackModal() {
  const ctx = useContext(FeedbackModalContext);
  if (!ctx) throw new Error('FeedbackModalTrigger must be used inside FeedbackModalProvider');
  return ctx;
}

function FeedbackFormContent() {
  const { setOpen } = useFeedbackModal();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FeedbackFormData>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: { description: '' },
  });

  const onSubmit = async (data: FeedbackFormData) => {
    setStatus('loading');
    setSubmitError(null);
    const formData = new FormData();
    formData.set('description', data.description);
    try {
      const result = await submitFeedback(formData);
      if (result.success) {
        setStatus('success');
        reset();
        setTimeout(() => setOpen(false), 2000);
      } else {
        setStatus('idle');
        setSubmitError(result.error ?? 'Failed to send feedback.');
      }
    } catch (err) {
      setStatus('idle');
      setSubmitError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      );
    }
  };

  if (status === 'success') {
    return (
      <div className="py-6 text-center">
        <p className="text-sm font-medium text-foreground">
          Thank you for your feedback!
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="feedback-description" className="sr-only">
          Description
        </label>
        <Textarea
          id="feedback-description"
          placeholder="Tell us what's on your mind..."
          rows={5}
          className="min-h-[120px] resize-y"
          disabled={status === 'loading'}
          aria-invalid={!!errors.description}
          aria-describedby={
            errors.description ? 'feedback-description-error' : undefined
          }
          {...register('description')}
        />
        {errors.description && (
          <p id="feedback-description-error" className="text-sm text-destructive">
            {errors.description.message}
          </p>
        )}
        {submitError && (
          <p className="text-sm text-destructive" role="alert">
            {submitError}
          </p>
        )}
      </div>
      <DialogFooter showCloseButton={false} className="sm:justify-end">
        <Button type="submit" disabled={status === 'loading'}>
          {status === 'loading' ? 'Sending…' : 'Send Feedback'}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Wrap layout (or app) so the trigger can open the modal from anywhere. */
export function FeedbackModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <FeedbackModalContext.Provider value={{ open, setOpen }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Share Your Thoughts</DialogTitle>
            <DialogDescription>
              Report bugs, suggest feature ideas, ask questions—we read every
              submission.
            </DialogDescription>
          </DialogHeader>
          <FeedbackFormContent />
        </DialogContent>
      </Dialog>
    </FeedbackModalContext.Provider>
  );
}

/** Alias for lesson wording: use FeedbackModalProvider in layout. */
export { FeedbackModalProvider as FeedbackModal };

/** Place in header, footer, or nav. Opens the feedback modal. */
export function FeedbackModalTrigger() {
  const { setOpen } = useFeedbackModal();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        'text-sm font-medium text-muted-foreground underline-offset-4',
        'hover:text-foreground hover:underline transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded'
      )}
    >
      Give Feedback
    </button>
  );
}
