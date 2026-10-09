/**
 * Capture a tangent into the Dept1 inbox. Does not do the tangent.
 *
 *   npm run dabos:route -- --text "<idea>" --from-task <id> [--suggest DeptN]
 *
 * Suggested dept: --suggest, else path-ownership.yaml, else keywords. Dept1 if none match.
 * Set DABOS_ROOT to the DABOS checkout that holds path-ownership.yaml.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

import { createDabosSql } from '../../src/lib/dabos/dabos-connection';
import { requireDatabaseUrl } from './load-env';

type Rule = { glob: string; dept: string };

const KEYWORDS: { re: RegExp; dept: string }[] = [
  { re: /\b(german-financial-planning|household dossier|gfp)\b/i, dept: 'Dept6' },
  { re: /\b(tailscale|ln02|paperless|homelab)\b/i, dept: 'Dept9' },
  { re: /\b(e[uü]r|gnucash|zoho books|ledger)\b/i, dept: 'Dept8' },
  { re: /\b(policy-source|quality sweep)\b/i, dept: 'Dept14' },
  { re: /\b(compliance|gdpr|dsgvo)\b/i, dept: 'Dept15' },
  { re: /\b(ship-log|vercel deploy)\b/i, dept: 'Dept12' },
  { re: /\b(founder-desk|session log|executive director)\b/i, dept: 'Dept21' },
  { re: /\b(path-ownership|hat-on-post|organizing board|\besto\b)/i, dept: 'Dept20' },
  { re: /\b(linear|despatch|routing log)\b/i, dept: 'Dept2' },
  { re: /\b(engineering|cursor rule)\b/i, dept: 'Dept11' },
  { re: /\b(intake|inbox|mail triage)\b/i, dept: 'Dept1' },
];

function argValue(args: string[], name: string): string | null {
  const idx = args.indexOf(name);
  if (idx < 0) return null;
  const value = args[idx + 1];
  if (!value || value.startsWith('--')) return null;
  return value;
}

function normalizeDept(raw: string): string | null {
  const match = raw.trim().match(/^Dept0*(\d{1,2})$/i);
  if (!match) return null;
  const n = Number(match[1]);
  if (n < 1 || n > 21) return null;
  return `Dept${n}`;
}

function findOwnershipFile(): string | null {
  const rel = path.join('docs', 'reference', 'dept20-organizing', 'path-ownership.yaml');
  const candidates: string[] = [];
  if (process.env.DABOS_ROOT) candidates.push(path.join(process.env.DABOS_ROOT, rel));
  candidates.push(path.join('C:\\Dev\\DABOS', rel));
  const wt = 'C:\\Dev\\_wt';
  if (fs.existsSync(wt)) {
    for (const name of fs.readdirSync(wt)) {
      if (name.toLowerCase().includes('dabos')) {
        candidates.push(path.join(wt, name, rel));
      }
    }
  }
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

function parseOwnership(text: string): Rule[] {
  const rules: Rule[] = [];
  let glob: string | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const globMatch = line.match(/^-?\s*glob:\s*(.+)$/);
    if (globMatch) {
      glob = globMatch[1].trim().replace(/^["']|["']$/g, '');
      continue;
    }
    const deptMatch = line.match(/^dept:\s*(Dept0*\d{1,2})\s*$/i);
    if (deptMatch && glob) {
      const dept = normalizeDept(deptMatch[1]);
      if (dept) rules.push({ glob, dept });
      glob = null;
    }
  }
  return rules;
}

function suggestFromYaml(text: string, rules: Rule[]): string | null {
  const hay = text.replace(/\\/g, '/').toLowerCase();
  for (const rule of rules) {
    if (!rule.glob.includes('*')) {
      const base = rule.glob.split('/').pop()?.toLowerCase() ?? '';
      if (hay.includes(rule.glob.toLowerCase()) || (base && hay.includes(base))) {
        return rule.dept;
      }
      continue;
    }
    const deptFolder = rule.glob.match(/dept(\d{2})/i);
    if (!deptFolder) continue;
    const padded = deptFolder[1];
    const plain = String(Number(padded));
    if (
      hay.includes(`dept${padded}`) ||
      hay.includes(`dept${plain}`) ||
      hay.includes(`dept ${plain}`)
    ) {
      return rule.dept;
    }
  }
  return null;
}

function suggestDept(text: string, explicit: string | null, rules: Rule[]): string {
  if (explicit) return explicit;
  const named = text.match(/\bDept\s*0*(\d{1,2})\b/i);
  if (named) {
    const dept = normalizeDept(`Dept${named[1]}`);
    if (dept) return dept;
  }
  return suggestFromYaml(text, rules) ?? KEYWORDS.find((row) => row.re.test(text))?.dept ?? 'Dept1';
}

async function main() {
  const args = process.argv.slice(2);
  const text = argValue(args, '--text');
  const fromTask = argValue(args, '--from-task');
  const suggestArg = argValue(args, '--suggest');
  const suggest = suggestArg ? normalizeDept(suggestArg) : null;

  if (!text || !fromTask || (suggestArg && !suggest)) {
    console.error(
      'Usage: npm run dabos:route -- --text "<idea>" --from-task <id> [--suggest DeptN]'
    );
    process.exit(1);
  }

  const ownershipPath = findOwnershipFile();
  const rules = ownershipPath ? parseOwnership(fs.readFileSync(ownershipPath, 'utf8')) : [];
  const suggested = suggestDept(text, suggest, rules);
  const sql = createDabosSql(requireDatabaseUrl());

  const fromRows = await sql`
    SELECT id::text AS id
    FROM tasks
    WHERE id::text = ${fromTask}
       OR (${fromTask.length >= 8} AND id::text LIKE ${`${fromTask}%`})
    LIMIT 2
  `;
  if (fromRows.length !== 1) {
    console.error(fromRows.length === 0 ? `No task for ${fromTask}` : `Task id ${fromTask} is ambiguous`);
    process.exit(1);
  }
  const fromId = String(fromRows[0].id);

  const deptRow = await sql`
    SELECT division_id FROM departments WHERE id = 'Dept1' LIMIT 1
  `;
  const divisionId = deptRow[0] ? String(deptRow[0].division_id) : 'Div1';
  const externalId = `route:${fromId}:${crypto.randomUUID()}`;
  const title = text.replace(/\s+/g, ' ').trim().slice(0, 200) || 'Routed idea';
  const description = [
    text.trim(),
    '',
    `from_task: ${fromId}`,
    `suggested_dept: ${suggested}`,
    `IN: api · ${externalId}`,
  ].join('\n');
  const meta = {
    mouth: 'api',
    external_id: externalId,
    from_task: fromId,
    suggested_dept: suggested,
    ownership_file: ownershipPath,
  };

  const inserted = await sql`
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
      basket,
      ingest_source,
      ingest_external_id,
      ingest_meta
    ) VALUES (
      ${'ingest-api'},
      ${divisionId},
      ${'Dept1'},
      ${title},
      ${description},
      ${'human'},
      ${'todo'},
      ${3},
      ${'founder'},
      ${'in'},
      ${'api'},
      ${externalId},
      ${JSON.stringify(meta)}::jsonb
    )
    RETURNING id::text AS id
  `;

  console.log(String(inserted[0].id));

  if ('end' in sql && typeof sql.end === 'function') {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
