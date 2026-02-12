'use server';

import { headers } from 'next/headers';
import { feedbackSchema } from '@/lib/schemas/feedback';

export type SubmitFeedbackResult =
  | { success: true; message: string }
  | { success: false; error: string };

/**
 * Server Action: Submit feedback to n8n webhook.
 * Anonymous feedback only (no auth for MVP).
 */
export async function submitFeedback(
  formData: FormData
): Promise<SubmitFeedbackResult> {
  try {
    const raw =
      formData.get('description')?.toString().trim() ??
      formData.get('message')?.toString().trim();
    const validation = feedbackSchema.safeParse({ description: raw });
    if (!validation.success) {
      const error = validation.error.errors[0]?.message ?? 'Invalid feedback';
      return { success: false, error };
    }

    const headersList = await headers();
    const browser = headersList.get('user-agent') ?? undefined;
    const referer = headersList.get('referer') ?? undefined;
    const timestamp = new Date().toISOString();

    const payload = {
      firstName: 'Anonymous',
      lastName: '',
      email: undefined as string | undefined,
      message: validation.data.description,
      browser,
      timestamp,
      url: referer,
    };

    const webhookUrl = process.env.N8N_FEEDBACK_WEBHOOK_URL;
    if (!webhookUrl) {
      console.error('[submitFeedback] N8N_FEEDBACK_WEBHOOK_URL not configured');
      return {
        success: false,
        error: 'Feedback service is not configured. Please try again later.',
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          error: 'Failed to send feedback. Please try again.',
        };
      }

      return {
        success: true,
        message: 'Feedback submitted successfully',
      };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timed out. Please try again.',
        };
      }
      throw err;
    }
  } catch (err) {
    console.error('[submitFeedback] Unexpected error:', err);
    return {
      success: false,
      error: 'Something went wrong. Please try again.',
    };
  }
}
