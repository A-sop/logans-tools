/**
 * Shared ingest (I0) — parallel IN-baskets → one Neon comm center.
 * ESTO flap §F: Telegram / Slack / Buzz call the same shape.
 * Wire field `mouth` = which IN (do not teach as org anatomy).
 */
import type { Sql } from '@/lib/dabos/db';

export type IngestMouth = 'telegram' | 'slack' | 'buzz' | 'api'; // wire: which IN

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
  let department_id = input.department_id ?? parsed.department_id ?? 'Dept1';
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

  const urls = input.urls ?? [];
  const attachments = input.attachments ?? [];
  const description = [
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

  const meta = {
    mouth: input.mouth,
    external_id,
    urls,
    attachments,
    wiki_bundle: input.wiki_bundle ?? null,
    captured_at: input.captured_at ?? new Date().toISOString(),
    is_work: parsed.is_work,
    is_agent: parsed.is_agent,
  };

  const priority = Math.min(5, Math.max(1, input.priority ?? (parsed.is_work ? 2 : 3)));
  const taskType = parsed.is_agent ? 'agent' : 'human';
  const assignedTo = parsed.is_agent ? null : 'founder';
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
      ${parsed.title},
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
