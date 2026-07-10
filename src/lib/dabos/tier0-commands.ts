import type { Sql } from '@/lib/dabos/db';

import {
  decideApproval,
  fetchPendingApprovals,
  formatTier0Approvals,
  formatTier0Board,
  formatTier0Stats,
} from '@/lib/dabos/tier0';

export function tier0HelpText(): string {
  return [
    'LDW Comm (Tier 0 — no LLM)',
    '/stats — division stats',
    '/board — condition snapshot',
    '/approvals — pending approval queue',
    '/approve <id> — approve (short id ok if unique prefix)',
    '/reject <id> — reject',
    '/help — this message',
  ].join('\n');
}

async function resolveApprovalId(sql: Sql, shortId: string): Promise<string> {
  const pending = await fetchPendingApprovals(sql, 50);
  const match = pending.filter((p) => p.id.startsWith(shortId));
  if (match.length === 1) return match[0].id;
  if (match.length > 1) {
    throw new Error(`Ambiguous id prefix "${shortId}" — use more chars`);
  }
  throw new Error(`No pending approval matching "${shortId}"`);
}

/** Shared Tier 0 command handler (Telegram exec, Slack gateway, tests). */
export async function executeTier0Command(
  sql: Sql,
  text: string,
  decidedBy: string
): Promise<string> {
  const parts = text.trim().split(/\s+/);
  const cmd = (parts[0] || '').toLowerCase();
  const arg = parts[1] || '';

  switch (cmd) {
    case '/start':
    case '/help':
      return tier0HelpText();
    case '/stats':
      return formatTier0Stats(sql);
    case '/board':
      return formatTier0Board(sql);
    case '/approvals':
      return formatTier0Approvals(sql);
    case '/approve': {
      if (!arg) return 'Usage: /approve <id>';
      const id = arg.length >= 36 ? arg : await resolveApprovalId(sql, arg);
      const result = await decideApproval(sql, id, 'approve', decidedBy);
      if (!result.ok) return result.error;
      return `Approved: ${result.row.title}`;
    }
    case '/reject': {
      if (!arg) return 'Usage: /reject <id>';
      const id = arg.length >= 36 ? arg : await resolveApprovalId(sql, arg);
      const result = await decideApproval(sql, id, 'reject', decidedBy);
      if (!result.ok) return result.error;
      return `Rejected: ${result.row.title}`;
    }
    default:
      return `Unknown command. ${tier0HelpText()}`;
  }
}

/** Map `/dabos stats` slash-command text to Tier 0 command strings. */
export function normalizeSlashCommandText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return '/help';

  const parts = trimmed.split(/\s+/);
  const head = parts[0]?.toLowerCase() ?? '';
  const rest = parts.slice(1).join(' ');

  const map: Record<string, string> = {
    stats: '/stats',
    board: '/board',
    approvals: '/approvals',
    help: '/help',
    start: '/help',
  };

  if (head === 'approve' && rest) return `/approve ${rest}`;
  if (head === 'reject' && rest) return `/reject ${rest}`;
  if (map[head]) return map[head];
  if (trimmed.startsWith('/')) return trimmed;
  return null;
}
