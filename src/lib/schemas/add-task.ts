import { z } from 'zod';

const TASK_STATUSES = ['todo', 'in_progress', 'waiting', 'done'] as const;
const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

/** Schema for add-task Server Action input. */
export const addTaskSchema = z.object({
  title: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, 'Title is required').max(500, 'Title is too long')),
  caseId: z
    .string()
    .nullable()
    .transform((v) => (v === '' || v === 'unassigned' ? null : v)),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  dueDate: z
    .string()
    .transform((s) => s?.trim() || new Date().toISOString().slice(0, 10))
    .refine((s) => isoDateRegex.test(s), 'Invalid date format'),
  owner: z
    .string()
    .transform((s) => (s?.trim() || 'Assistant'))
    .pipe(z.string().min(1).max(100)),
  waitingOn: z
    .string()
    .optional()
    .transform((s) => (s?.trim() || undefined)),
});

export type AddTaskInput = z.infer<typeof addTaskSchema>;
