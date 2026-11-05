/**
 * RR-010 step 1: the send side of the agent inbox (AC2). Agents leave messages in agent_inbox and
 * the watchman (src/lib/dabos/watchman.ts) decides whether the recipient is woken now or batched.
 * Standard for agents: src/docs/dabos/agent-inbox.md.
 *
 * Pure validation + SQL building, plus one insert helper. The CLI is scripts/dabos/dabos-inbox.ts.
 */
import type { DabosSql } from '@/lib/dabos/dabos-connection';
import {
  AGENT_IDS,
  LOGAN,
  URGENCY_CLAIMS,
  WATCHMAN_SENDER,
  berlinWallToUtc,
  normaliseAgent,
  type UrgencyClaim,
} from '@/lib/dabos/watchman';

export type SendInput = {
  from: string;
  to: string;
  subject: string;
  body: string;
  claim: UrgencyClaim;
  reason: string | null;
  deadlineAt: Date | null;
  blocks: string | null;
  dedupeKey: string;
};

/** CLI / validateSend allowlist. `logan` is refused (Amendment 2 A7); `watchman` is script-only. */
export const SENDERS: ReadonlySet<string> = new Set<string>([...AGENT_IDS]);
export const DEDUPE_KEY_FORMAT = /^[a-z0-9][a-z0-9_.:#@/-]{2,199}$/;

/**
 * AC2: secrets, DVAG client data and Whop order data never go in a subject or body. Only the
 * machine-recognisable shapes can be refused here; the rest is the sender's duty (see the doc).
 */
export const FORBIDDEN_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: 'cursor api key', re: /\bcrsr_[A-Za-z0-9]{8,}/ },
  { name: 'github token', re: /\b(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/ },
  { name: 'database url with password', re: /\b(postgres(ql)?|mysql):\/\/[^\s:@/]+:[^\s@/]+@/i },
  { name: 'neon password', re: /\bnpg_[A-Za-z0-9]{10,}/ },
  { name: 'stripe or whop secret key', re: /\b(sk|rk)_(live|test)_[A-Za-z0-9]{10,}|\bapik_[A-Za-z0-9]{10,}/ },
  { name: 'private key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'bearer token', re: /\bBearer\s+[A-Za-z0-9._~+/-]{20,}/ },
  { name: 'iban', re: /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,3})?\b/ },
];

export function forbiddenContent(text: string): string[] {
  return FORBIDDEN_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.name);
}

/** ISO with Z/offset, or "YYYY-MM-DD HH:MM" / "YYYY-MM-DDTHH:MM" read as Berlin wall time. */
export function parseDeadline(raw: string): Date {
  const s = raw.trim();
  const local = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})$/.exec(s);
  if (local) return berlinWallToUtc(local[1]!, Number(local[2]), Number(local[3]));
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d;
  }
  throw new Error(`deadline must be ISO with an offset or "YYYY-MM-DD HH:MM" (Berlin), got ${s}`);
}

export function validateSend(input: SendInput): string[] {
  const errors: string[] = [];
  if (input.from === LOGAN)
    errors.push("from cannot be logan: Logan's words go through an ldw relay (logan_order / logan_decision)");
  else if (input.from === WATCHMAN_SENDER)
    errors.push('from cannot be watchman: only the watchman script files failure rows');
  else if (!SENDERS.has(input.from)) errors.push(`from must be one of ${[...SENDERS].join(', ')}`);
  if (input.to === LOGAN) errors.push('to cannot be logan: put Logan\'s yes/no in approval_queue');
  else if (!(AGENT_IDS as readonly string[]).includes(input.to))
    errors.push(`to must be one of ${AGENT_IDS.join(', ')}`);
  if (input.from === input.to) errors.push('from and to are the same agent');
  if (!input.subject.trim() || input.subject.length > 200) errors.push('subject must be 1-200 characters');
  if (input.body.length > 8000) errors.push('body must be at most 8000 characters');
  if (!(URGENCY_CLAIMS as readonly string[]).includes(input.claim))
    errors.push(`claim must be one of ${URGENCY_CLAIMS.join(', ')}`);
  if (!DEDUPE_KEY_FORMAT.test(input.dedupeKey))
    errors.push('key must be 3-200 chars of a-z 0-9 _ . : # @ / - (lowercase), e.g. div4:lt-pr-63-ready');
  if (input.claim !== 'none' && !input.reason?.trim())
    errors.push('a claim needs a reason (it would be downgraded to the batch)');
  if (input.claim === 'deadline_today' && !input.deadlineAt) errors.push('deadline_today needs --deadline');
  if (input.claim === 'blocking' && !input.blocks?.trim()) errors.push('blocking needs --blocks');
  for (const [field, text] of [
    ['subject', input.subject],
    ['body', input.body],
    ['reason', input.reason ?? ''],
    ['blocks', input.blocks ?? ''],
  ] as const) {
    const hits = forbiddenContent(text);
    if (hits.length) errors.push(`${field} looks like it holds forbidden content (${hits.join(', ')}); remove it`);
    if (text.includes('\u0000')) errors.push(`${field} contains a NUL character`);
  }
  return errors;
}

export function sqlLiteral(v: string | null): string {
  return v === null ? 'NULL' : `'${v.replace(/'/g, "''")}'`;
}

/** The one-statement INSERT agents run through the Neon tool (same text the CLI prints). */
export function buildInsertSql(input: SendInput): string {
  const errors = validateSend(input);
  if (errors.length) throw new Error(errors.join('; '));
  const deadline = input.deadlineAt ? `${sqlLiteral(input.deadlineAt.toISOString())}::timestamptz` : 'NULL';
  return (
    'INSERT INTO agent_inbox (from_agent, to_agent, subject, body, urgency_claim, urgency_reason, deadline_at, blocks, dedupe_key) VALUES (' +
    [
      sqlLiteral(input.from),
      sqlLiteral(input.to),
      sqlLiteral(input.subject),
      sqlLiteral(input.body),
      sqlLiteral(input.claim),
      sqlLiteral(input.reason?.trim() || null),
      deadline,
      sqlLiteral(input.blocks?.trim() || null),
      sqlLiteral(input.dedupeKey),
    ].join(', ') +
    ') ON CONFLICT ON CONSTRAINT agent_inbox_dedupe_content_uq DO NOTHING RETURNING id;'
  );
}

export async function insertSend(sql: DabosSql, input: SendInput): Promise<string | null> {
  const errors = validateSend(input);
  if (errors.length) throw new Error(errors.join('; '));
  const rows = (await sql`
    INSERT INTO agent_inbox (from_agent, to_agent, subject, body, urgency_claim, urgency_reason, deadline_at, blocks, dedupe_key)
    VALUES (${input.from}, ${input.to}, ${input.subject}, ${input.body}, ${input.claim},
            ${input.reason?.trim() || null}, ${input.deadlineAt ? input.deadlineAt.toISOString() : null}::timestamptz,
            ${input.blocks?.trim() || null}, ${input.dedupeKey})
    ON CONFLICT ON CONSTRAINT agent_inbox_dedupe_content_uq DO NOTHING
    RETURNING id
  `) as Array<{ id: string }>;
  return rows[0]?.id ?? null;
}

export type CliArgs = { command: string; input: SendInput; bodyFile: string | null; printSql: boolean };

/** `dabos-inbox send --from div4 --to div5 --subject ... --key ... [--body ... | --body-file f]` */
export function parseSendArgs(argv: string[]): CliArgs {
  const [command = '', ...rest] = argv;
  const opts = new Map<string, string>();
  let printSql = false;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === '--print-sql') {
      printSql = true;
      continue;
    }
    if (!a.startsWith('--')) throw new Error(`unexpected argument ${a}`);
    const v = rest[i + 1];
    if (v === undefined) throw new Error(`${a} needs a value`);
    opts.set(a.slice(2), v);
    i++;
  }
  const known = ['from', 'to', 'subject', 'body', 'body-file', 'claim', 'reason', 'deadline', 'blocks', 'key'];
  for (const k of opts.keys()) if (!known.includes(k)) throw new Error(`unknown option --${k}`);
  if (opts.has('body') && opts.has('body-file')) throw new Error('use --body or --body-file, not both');
  const deadline = opts.get('deadline');
  return {
    command,
    printSql,
    bodyFile: opts.get('body-file') ?? null,
    input: {
      from: normaliseAgent(opts.get('from') ?? ''),
      to: normaliseAgent(opts.get('to') ?? ''),
      subject: opts.get('subject') ?? '',
      body: opts.get('body') ?? '',
      claim: (opts.get('claim') ?? 'none') as UrgencyClaim,
      reason: opts.get('reason') ?? null,
      deadlineAt: deadline ? parseDeadline(deadline) : null,
      blocks: opts.get('blocks') ?? null,
      dedupeKey: opts.get('key') ?? '',
    },
  };
}
