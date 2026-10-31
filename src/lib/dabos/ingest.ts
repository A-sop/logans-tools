/**
 * Shared ingest (I0) — parallel IN-baskets → one Neon comm center.
 * ESTO flap §F: Telegram / Slack / Buzz call the same shape.
 * Wire field `mouth` = which IN (do not teach as org anatomy).
 */
import { createHash } from 'crypto';

import type { Sql } from '@/lib/dabos/db';

export function urlHash(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 32);
}

export type IngestMouth = 'telegram' | 'slack' | 'buzz' | 'api'; // wire: which IN

/**
 * DVAG keyword regex — never post captures matching these terms.
 * Word boundaries prevent false positives (provisorisch, Provisorium, improvisor).
 * Note: verm(ö|oe)gensberat matches Vermögensberater, Vermögensberatung, etc.
 */
export const DVAG_KEYWORD_REGEX = /\b(?:dvag|deutsche\s+verm(?:ö|oe)gensberatung|verm(?:ö|oe)gensberat\w*|proviso|allfinanz)\b/i;

export type IngestBasket = 'in' | 'pending' | 'out';

export type IngestInput = {
  mouth: IngestMouth;
  external_id: string;
  text: string;
  urls?: string[];
  attachments?: string[];
  captured_at?: string;
  /** Optional wiki bundle path / name (Telegram local write). */
  wiki_bundle?: string;
  department_id?: string | null;
  division_id?: string | null;
  priority?: number;
  title?: string;
  sha256?: string;
  store_path?: string;
};

export type IngestResult = {
  created: boolean;
  task_id: string;
  short_id: string;
  basket: IngestBasket;
  department_id: string;
  division_id: string;
  title: string;
  ack: string;
};

/**
 * Hat table: docs/reference/dept01-intake/intake-classification-hat.md (DABOS). Keep in sync.
 * Deterministic first pass at ingest. Routes only when exactly one department matches;
 * otherwise the capture stays in Dept1 and the Dept1 batch (telegram_extract.py route) classifies it.
 */
export const HAT_SIGNALS: { dept: string; label: string; re: RegExp }[] = [
  { dept: 'Dept15', label: 'regulatory/tax/legal/residency', re: /\b(steuer\w*|finanzamt|tax(es)?|legal|law(yer)?|visa|residency|aufenthalt\w*|gdpr|dsgvo|compliance|regulat\w*)\b/i },
  { dept: 'Dept8', label: 'finance/money/investing/accounting', re: /\b(invest\w*|etf|stocks?|aktie\w*|dividend\w*|accounting|buchhaltung|ledger|gnucash|budget\w*|portfolio|crypto|bitcoin)\b/i },
  { dept: 'Dept16', label: 'marketing/lead-gen/brand/audience', re: /\b(marketing|lead[- ]?gen\w*|leads|brand(ing)?|audience|seo|funnel|ads?|newsletter|instagram growth|followers)\b/i },
  { dept: 'Dept17', label: 'sales/clients/pricing/consulting', re: /\b(sales|selling|clients?|pricing|price your|consulting|closing|cold call\w*|offer)\b/i },
  { dept: 'Dept4', label: 'content production', re: /\b(video editing|youtube (channel|craft|thumbnail\w*)|thumbnails?|script ?writing|copywriting|kdp|kindle|podcast)\b/i },
  { dept: 'Dept10', label: 'AI/tooling/systems/code', re: /\b(ai|llm|gpt|claude|cursor|agents?|n8n|automation|github|code|coding|python|homelab|self-?host\w*|ollama|api)\b/i },
  { dept: 'Dept20', label: 'venture/business-model', re: /\b(business model|side hustle|startup|saas|venture|passive income|dropshipping|fba)\b/i },
  { dept: 'Dept21', label: 'founder health/personal growth', re: /\b(health|sleep|fitness|workout|meditat\w*|habits?|mindset|discipline|nutrition)\b/i },
];

export function classifyCapture(text: string): { department_id: string | null; reason: string; candidates: string[] } {
  const hits = HAT_SIGNALS.filter((s) => s.re.test(text || ''));
  if (hits.length === 1) {
    return { department_id: hits[0].dept, reason: `ingest hat signal: ${hits[0].label}`, candidates: [hits[0].dept] };
  }
  return {
    department_id: null,
    reason: hits.length ? `ambiguous at ingest: ${hits.map((h) => h.dept).join(' or ')}` : 'no hat signal at ingest; Dept1 batch classifies',
    candidates: hits.map((h) => h.dept),
  };
}

const DEPT_RE = /^(?:dept:|#)?(Dept\d{1,2})\b[:\s-]*/i;
const TASK_PREFIX_RE = /^(?:task|despatch|dispatch|agent)\s*:\s*/i;

export function parseIngestText(raw: string): {
  title: string;
  body: string;
  department_id: string | null;
  is_work: boolean;
  is_agent: boolean;
} {
  let text = raw.trim();
  let is_work = false;
  if (TASK_PREFIX_RE.test(text)) {
    is_work = true;
    text = text.replace(TASK_PREFIX_RE, '').trim();
  }

  let department_id: string | null = null;
  const deptMatch = text.match(DEPT_RE);
  if (deptMatch) {
    const num = String(deptMatch[1]).replace(/^Dept/i, '');
    department_id = `Dept${num}`;
    text = text.slice(deptMatch[0].length).trim();
  }

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const title = (lines[0] || 'Capture').slice(0, 200);
  const body = text || '(empty)';
  return { title, body, department_id, is_work, is_agent: is_work };
}

export function formatIngestAck(opts: {
  short_id: string;
  summary: string;
  created: boolean;
}): string {
  const verb = opts.created ? 'Saved' : 'Already';
  return `${verb} · task ${opts.short_id} · ${opts.summary}`;
}

function summarizeParts(input: IngestInput): string {
  const parts: string[] = [];
  if (input.text?.trim()) parts.push('text');
  if (input.urls?.length) {
    parts.push(`${input.urls.length} link${input.urls.length > 1 ? 's' : ''}`);
  }
  if (input.attachments?.length) {
    parts.push(
      `${input.attachments.length} file${input.attachments.length > 1 ? 's' : ''}`
    );
  }
  return parts.length ? parts.join(', ') : 'empty';
}

export async function ingestCapture(
  sql: Sql,
  input: IngestInput
): Promise<IngestResult> {
  const external_id = input.external_id.trim();
  if (!external_id) {
    throw new Error('external_id required');
  }

  const existing = await sql`
    SELECT id, basket, department_id, division_id, title
    FROM tasks
    WHERE ingest_source = ${input.mouth}
      AND ingest_external_id = ${external_id}
    LIMIT 1
  `;

  if (existing[0]) {
    const row = existing[0] as {
      id: string;
      basket: IngestBasket;
      department_id: string | null;
      division_id: string;
      title: string;
    };
    const short_id = String(row.id).slice(0, 8);
    return {
      created: false,
      task_id: String(row.id),
      short_id,
      basket: row.basket ?? 'in',
      department_id: row.department_id ?? 'Dept1',
      division_id: row.division_id,
      title: row.title,
      ack: formatIngestAck({
        short_id,
        summary: summarizeParts(input),
        created: false,
      }),
    };
  }

  const parsed = parseIngestText(input.text || '');
  const isDvag = DVAG_KEYWORD_REGEX.test(input.text || '');
  // DVAG items: no keyword routing, Proviso case index is SSOT (counts only).
  const auto = isDvag ? null : classifyCapture([input.text || '', input.title || ''].join(' '));
  let department_id = input.department_id ?? parsed.department_id ?? auto?.department_id ?? 'Dept1';
  const routed_reason =
    input.department_id || parsed.department_id
      ? 'explicit DeptN tag'
      : isDvag
        ? 'DVAG item: Proviso case index (counts only)'
        : auto?.reason ?? '';

  // Exact full-URL duplicates (hat rule: never normalise). Keep both; raise priority.
  let dupOf: { id: string; department_id: string; priority: number } | null = null;
  for (const url of input.urls ?? []) {
    const hit = await sql`
      SELECT id, department_id, priority FROM tasks
      WHERE ingest_source IN ('telegram', 'youtube') AND status NOT IN ('done', 'cancelled')
        AND (ingest_meta->'urls' ? ${url} OR ingest_meta->'url_hashes' ? ${urlHash(url)})
      ORDER BY priority ASC LIMIT 1`;
    if (hit[0]) { dupOf = hit[0] as { id: string; department_id: string; priority: number }; break; }
  }
  if (dupOf) {
    const raised = Math.max(1, Number(dupOf.priority ?? 3) - 1);
    await sql`
      UPDATE tasks SET priority = ${raised},
        ingest_meta = coalesce(ingest_meta, '{}'::jsonb) || jsonb_build_object(
          'dup_count', coalesce((ingest_meta->>'dup_count')::int, 1) + 1),
        updated_at = now()
      WHERE id = ${dupOf.id}`;
    if (!input.department_id && !parsed.department_id && dupOf.department_id) department_id = dupOf.department_id;
  }
  let division_id = input.division_id ?? null;

  const deptRow = await sql`
    SELECT id, division_id FROM departments WHERE id = ${department_id} LIMIT 1
  `;
  if (!deptRow[0]) {
    department_id = 'Dept1';
    division_id = 'Div1';
  } else if (!division_id) {
    division_id = String((deptRow[0] as { division_id: string }).division_id);
  }

  const isPointerMode = Boolean(input.sha256 && input.store_path);

  let title: string;
  let description: string;
  let meta: Record<string, unknown>;

  if (isPointerMode) {
    const sha256 = input.sha256!.toLowerCase();
    title = input.title || 'Capture';
    description = [
      `Pointer: ${input.store_path}`,
      `sha256: ${sha256}`,
      `IN: ${input.mouth} · ${external_id}`,
    ].join('\n');
    meta = {
      mouth: input.mouth,
      external_id,
      sha256,
      store_path: input.store_path,
      wiki_bundle: input.wiki_bundle ?? null,
      pointer: true,
      captured_at: input.captured_at ?? new Date().toISOString(),
      is_work: parsed.is_work,
      is_agent: parsed.is_agent,
      routed_reason,
      route_candidates: auto?.candidates ?? [],
      url_hashes: (input.urls ?? []).map(urlHash),
      ...(dupOf ? { dup_of: dupOf.id } : {}),
    };
  } else {
    const urls = input.urls ?? [];
    const attachments = input.attachments ?? [];
    title = parsed.title;
    description = [
      parsed.body,
      urls.length ? `\nURLs:\n${urls.map((u) => `- ${u}`).join('\n')}` : '',
      attachments.length
        ? `\nAttachments:\n${attachments.map((a) => `- ${a}`).join('\n')}`
        : '',
      input.wiki_bundle ? `\nWiki bundle: ${input.wiki_bundle}` : '',
      `\nIN: ${input.mouth} · ${external_id}`,
    ]
      .filter(Boolean)
      .join('');
    meta = {
      mouth: input.mouth,
      external_id,
      urls,
      attachments,
      wiki_bundle: input.wiki_bundle ?? null,
      captured_at: input.captured_at ?? new Date().toISOString(),
      is_work: parsed.is_work,
      is_agent: parsed.is_agent,
      routed_reason,
      route_candidates: auto?.candidates ?? [],
      ...(dupOf ? { dup_of: dupOf.id } : {}),
    };
  }

  const basePriority = input.priority ?? (parsed.is_work ? 2 : 3);
  const priority = Math.min(5, Math.max(1, dupOf ? Math.min(basePriority, Number(dupOf.priority ?? 3) - 1) : basePriority));
  // Dept1 intake rule: captures never go to the founder; agent by default.
  // Only a non-task item posted straight to the api mouth stays with the founder.
  const isCapture = input.mouth !== 'api';
  const taskType = parsed.is_agent || isCapture ? 'agent' : 'human';
  const assignedTo = parsed.is_agent || isCapture ? null : 'founder';
  const assignedAgent = parsed.is_agent ? 'research' : null;

  const rows = await sql`
    INSERT INTO tasks (
      workspace_id,
      division_id,
      department_id,
      title,
      description,
      type,
      status,
      priority,
      assigned_to,
      assigned_agent,
      basket,
      ingest_source,
      ingest_external_id,
      ingest_meta
    ) VALUES (
      ${`ingest-${input.mouth}`},
      ${division_id},
      ${department_id},
      ${title},
      ${description},
      ${taskType},
      ${'todo'},
      ${priority},
      ${assignedTo},
      ${assignedAgent},
      ${'in'},
      ${input.mouth},
      ${external_id},
      ${JSON.stringify(meta)}
    )
    RETURNING id, basket, department_id, division_id, title
  `;

  const row = rows[0] as {
    id: string;
    basket: IngestBasket;
    department_id: string;
    division_id: string;
    title: string;
  };

  try {
    await sql`
      INSERT INTO role_runs (role_id, role_type, summary_json)
      VALUES (
        ${parsed.is_work ? 'Dept2' : 'Dept1'},
        ${'department'},
        ${JSON.stringify({
          action: 'ingest_capture',
          mouth: input.mouth,
          task_id: row.id,
          external_id,
          department_id,
        })}
      )
    `;
  } catch {
    /* role_runs optional on older DBs */
  }

  const short_id = String(row.id).slice(0, 8);
  return {
    created: true,
    task_id: String(row.id),
    short_id,
    basket: row.basket ?? 'in',
    department_id: row.department_id,
    division_id: row.division_id,
    title: row.title,
    ack: formatIngestAck({
      short_id,
      summary: summarizeParts(input),
      created: true,
    }),
  };
}
