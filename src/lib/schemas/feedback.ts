import { z } from 'zod';

export const feedbackSchema = z.object({
  description: z
    .string()
    .min(1, 'Please enter at least one character')
    .trim(),
});

export type FeedbackFormData = z.infer<typeof feedbackSchema>;

/**
 * Structured feedback analysis from n8n AI Agent.
 * Matches the JSON schema expected from the AI Tools Agent workflow.
 */
export const feedbackAnalysisSchema = z.object({
  sentiment: z.enum(['positive', 'negative', 'neutral']),
  category: z.enum(['bug', 'feature_request', 'question', 'other']),
  priority: z.enum(['low', 'medium', 'high']),
  summary: z.string().min(1),
  actionable: z.boolean(),
});

export type FeedbackAnalysis = z.infer<typeof feedbackAnalysisSchema>;

/**
 * Complete feedback payload sent to n8n webhook (lesson 5.4).
 * Includes original feedback + optional analysis from n8n.
 */
export const feedbackPayloadSchema = z.object({
  description: z.string().min(1),
  userId: z.string().optional(), // Clerk user ID if authenticated
  userEmail: z.string().email().optional(),
  timestamp: z.string().datetime().optional(),
  analysis: feedbackAnalysisSchema.optional(),
});

export type FeedbackPayload = z.infer<typeof feedbackPayloadSchema>;
