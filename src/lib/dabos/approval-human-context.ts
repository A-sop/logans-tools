/**
 * Founder-facing CONTEXT for approval_queue rows.
 * Store ≤800 chars in human_context at create time — never dump PRDs into Neon or prompts.
 */

export const HUMAN_CONTEXT_MAX = 800;

/** Template agents fill when filing an approval_queue row. */
export const HUMAN_CONTEXT_TEMPLATE = `What: <one sentence>
Why now: <one sentence>
Yes: <what happens if Logan approves>
No: <what happens if Logan rejects>
Links: <1–3 paths or URLs — not file contents>`;

/**
 * Prefer human_context. If empty: body + useful payload path hints.
 * Never return alone `decision:other` (useless on the CONTEXT panel).
 */
export function resolveApprovalContext(input: {
  humanContext?: string | null;
  body?: string | null;
  payload?: Record<string, unknown> | null;
}): string | null {
  const hc = typeof input.humanContext === 'string' ? input.humanContext.trim() : '';
  if (hc) return hc.slice(0, HUMAN_CONTEXT_MAX);

  const parts: string[] = [];
  const body = typeof input.body === 'string' ? input.body.trim() : '';
  if (body) parts.push(body);

  const payload = input.payload && typeof input.payload === 'object' ? input.payload : {};
  const pathHints = approvalContextPathHints(payload);
  if (pathHints) parts.push(pathHints);

  if (!parts.length) return null;
  return parts.join('\n\n').slice(0, HUMAN_CONTEXT_MAX);
}

/** Path/repo/host hints from payload — skips bare decision:other. */
export function approvalContextPathHints(payload: Record<string, unknown>): string | null {
  const parts: string[] = [];
  const repo = payload.repo;
  const pr = payload.pr;
  if (typeof repo === 'string' && repo) {
    parts.push(typeof pr === 'number' || typeof pr === 'string' ? `${repo}#${pr}` : repo);
  }
  const host = payload.host;
  if (typeof host === 'string' && host) parts.push(`host:${host}`);
  const path = payload.path ?? payload.context_path ?? payload.file;
  if (typeof path === 'string' && path) parts.push(path);
  const decision = payload.decision;
  // decision alone is noise when it is just "other"; keep typed decisions with more context
  if (typeof decision === 'string' && decision && decision !== 'other') {
    parts.push(`decision:${decision}`);
  } else if (typeof decision === 'string' && decision === 'other' && parts.length > 0) {
    parts.push(`decision:${decision}`);
  }
  return parts.length ? parts.join(' · ') : null;
}

export function clampHumanContext(text: string): string {
  return text.trim().slice(0, HUMAN_CONTEXT_MAX);
}
