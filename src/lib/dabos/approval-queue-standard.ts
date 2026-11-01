/**
 * RR-010 step 2: approval_queue is the one place for Logan's yes/no (Logan, 1 Nov 2026 14:54
 * Berlin, relayed by LDW Communicator). Builds the filing key and checks the payload shape so
 * every agent and script files rows the same way. Standard: src/docs/dabos/approval-queue.md.
 * Pure: no database access here.
 */
import { z } from 'zod';

export const DECISION_TYPES = [
  'merge',
  'prod_apply',
  'machine_change',
  'secret_placement',
  'policy',
  'other',
] as const;
export type DecisionType = (typeof DECISION_TYPES)[number];

/** Same rule as the approval_queue_dedupe_key_format check in the 2026-11-01 SQL file. */
export const DEDUPE_KEY_PATTERN =
  /^(merge|prod_apply|machine_change|secret_placement|policy|other):\S+$/;
export const DEDUPE_KEY_MAX = 200;

const SHA_FULL = /^[0-9a-f]{40}$/;
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SLUG = /^[a-z0-9][a-z0-9._-]*$/;

export type DecisionKeyInput =
  | { decision: 'merge' | 'prod_apply'; repo: string; pr: number; headSha: string }
  | { decision: 'machine_change' | 'secret_placement'; host: string; slug: string }
  | { decision: 'policy' | 'other'; slug: string };

export function decisionKey(input: DecisionKeyInput): string {
  let key: string;
  switch (input.decision) {
    case 'merge':
    case 'prod_apply': {
      if (!REPO.test(input.repo)) throw new Error(`repo must be owner/name, got ${input.repo}`);
      if (!Number.isInteger(input.pr) || input.pr <= 0)
        throw new Error(`pr must be a positive integer`);
      const sha = input.headSha.toLowerCase();
      if (!SHA_FULL.test(sha)) throw new Error('headSha must be the full 40-character head sha');
      key = `${input.decision}:${input.repo}#${input.pr}@${sha.slice(0, 12)}`;
      break;
    }
    case 'machine_change':
    case 'secret_placement':
      if (!SLUG.test(input.host))
        throw new Error(`host must be a lowercase slug, got ${input.host}`);
      if (!SLUG.test(input.slug))
        throw new Error(`slug must be a lowercase slug, got ${input.slug}`);
      key = `${input.decision}:${input.host}:${input.slug}`;
      break;
    default:
      if (!SLUG.test(input.slug))
        throw new Error(`slug must be a lowercase slug, got ${input.slug}`);
      key = `${input.decision}:${input.slug}`;
  }
  if (!isValidDedupeKey(key)) throw new Error(`dedupe key out of format: ${key}`);
  return key;
}

export function isValidDedupeKey(key: string): boolean {
  return key.length <= DEDUPE_KEY_MAX && DEDUPE_KEY_PATTERN.test(key);
}

const verdict = z.string().regex(/^(PASS|FAIL|CONDITIONAL) @[0-9a-f]{40}$/);

/** payload of a Logan decision row. Extra keys are allowed; these are checked when present. */
export const decisionPayloadSchema = z
  .object({
    decision: z.enum(DECISION_TYPES),
    repo: z.string().regex(REPO).optional(),
    pr: z.number().int().positive().optional(),
    head_sha: z.string().regex(SHA_FULL).optional(),
    dept13_verdict: verdict.optional(),
    apply_method: z.string().max(300).optional(),
    host: z.string().regex(SLUG).optional(),
    order_ref: z.string().max(40).optional(),
    logan_words: z.string().max(2000).optional(),
    logan_at: z.string().max(40).optional(),
  })
  .passthrough()
  .superRefine((p, ctx) => {
    if (p.decision === 'merge' || p.decision === 'prod_apply') {
      for (const k of ['repo', 'pr', 'head_sha', 'dept13_verdict'] as const) {
        if (p[k] == null)
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${p.decision} needs ${k}` });
      }
      if (p.dept13_verdict && p.head_sha && !p.dept13_verdict.startsWith(`PASS @${p.head_sha}`)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'a merge/apply row is filed only after a Dept13 PASS at the same head sha',
        });
      }
    }
    if (p.decision === 'prod_apply' && !p.apply_method) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'prod_apply needs apply_method' });
    }
    if ((p.decision === 'machine_change' || p.decision === 'secret_placement') && !p.host) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${p.decision} needs host` });
    }
  });
export type DecisionPayload = z.infer<typeof decisionPayloadSchema>;

export type DecisionRow = { status: string; payload: { head_sha?: string } | null };

/**
 * The doing agent acts only on an approved row whose head sha is the PR's current head; a push
 * after the decision means the row must be expired and re-filed after a new Dept13 PASS.
 */
export function decisionState(
  row: DecisionRow,
  currentHeadSha?: string
): 'act' | 'wait' | 'rejected' | 'expired' | 'stale_sha' {
  if (row.status === 'pending') return 'wait';
  if (row.status === 'rejected') return 'rejected';
  if (row.status !== 'approved') return 'expired';
  const decided = row.payload?.head_sha?.toLowerCase();
  if (currentHeadSha && decided && decided !== currentHeadSha.toLowerCase()) return 'stale_sha';
  return 'act';
}
