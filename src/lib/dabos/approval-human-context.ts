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
Links: <1–3 brief/doc paths — never dabos.logans.tools/open (already in UI)>`;

/**
 * Strip open-wall self-links (founder is already in dabos UI).
 * Keep real brief/doc paths.
 */
export function scrubApprovalOpenSelfLinks(text: string): string {
  let out = text;
  out = out.replace(/https?:\/\/dabos\.logans\.tools\/open\b\/?/gi, '');
  out = out.replace(/(^|[\s·|,])\/dabos\/open\b\/?/gi, '$1');
  out = out.replace(/\s*·\s*·\s*/g, ' · ');
  out = out.replace(/Links:\s*·\s*/gi, 'Links: ');
  out = out.replace(/\s*·\s*$/gm, '');
  out = out.replace(/Links:\s*$/gim, '');
  out = out.replace(/[ \t]+\n/g, '\n');
  out = out.replace(/\n{3,}/g, '\n\n');
  return out.trim();
}

/**
 * Prefer human_context. If empty: body + useful payload path hints.
 * Never return alone `decision:other` (useless on the CONTEXT panel).
 */
export function resolveApprovalContext(input: {
  humanContext?: string | null;
  body?: string | null;
  payload?: Record<string, unknown> | null;
}): string | null {
  const hcRaw = typeof input.humanContext === 'string' ? input.humanContext.trim() : '';
  const hc = hcRaw ? scrubApprovalOpenSelfLinks(hcRaw) : '';
  if (hc) return hc.slice(0, HUMAN_CONTEXT_MAX);

  const parts: string[] = [];
  const bodyRaw = typeof input.body === 'string' ? input.body.trim() : '';
  const body = bodyRaw ? scrubApprovalOpenSelfLinks(bodyRaw) : '';
  if (body) parts.push(body);

  const payload = input.payload && typeof input.payload === 'object' ? input.payload : {};
  const pathHints = approvalContextPathHints(payload);
  if (pathHints) parts.push(pathHints);

  if (!parts.length) return null;
  return parts.join('\n\n').slice(0, HUMAN_CONTEXT_MAX);
}

/**
 * True when `body` (Prompt / agent summary) adds substance beyond human_context.
 * Used to hide near-duplicate Prompt boxes once Context is filled.
 */
export function bodyAddsBeyondHumanContext(
  body?: string | null,
  humanContext?: string | null
): boolean {
  const b = typeof body === 'string' ? scrubApprovalOpenSelfLinks(body.trim()) : '';
  if (!b) return false;
  const hc =
    typeof humanContext === 'string' ? scrubApprovalOpenSelfLinks(humanContext.trim()) : '';
  if (!hc) return true;

  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  const nb = norm(b);
  const nhc = norm(hc);
  if (!nb) return false;
  if (nhc.includes(nb)) return false;

  const words = nb.split(/\s+/).filter((w) => w.length > 3);
  if (!words.length) return false;
  const covered = words.filter((w) => nhc.includes(w)).length;
  return covered / words.length < 0.75;
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
  return scrubApprovalOpenSelfLinks(text).slice(0, HUMAN_CONTEXT_MAX);
}
