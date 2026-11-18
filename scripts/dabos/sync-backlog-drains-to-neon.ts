/**
 * Upsert OPEN-CHAT-BACKLOG drain rows (from dabos-open-loops.json) into Neon tasks.
 * Neon is the open-task SSOT; the JSON snapshot stays a deploy fallback + goals source.
 *
 *   npm run dabos:sync-backlog-to-neon
 *   npm run dabos:sync-backlog-to-neon -- --dry-run
 *
 * External id: chat-backlog:<drain-id>  (e.g. chat-backlog:261008_body-posts-talk)
 * Skips drains already present. Marks done when archive contains the section or
 * the why line is clearly closed.
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { createDabosSql } from "../../src/lib/dabos/dabos-connection";
import { requireDatabaseUrl } from "./load-env";

type SnapItem = {
  id: string;
  why: string;
  canonical: string;
  resume: string;
  heat: string;
  segment: string;
  dept: string;
  source: string;
};

function dabosRoot(): string {
  return process.env.DABOS_ROOT?.trim() || "C:\\Dev\\DABOS";
}

function buildDescription(item: SnapItem): string {
  const ssot = item.canonical?.trim() || "(set SSOT path when known)";
  const resume = item.resume?.trim() || item.id;
  const prompt = [
    `Hat: ${item.dept}. Open Neon task chat-backlog:${item.id}.`,
    `Read SSOT first, then do the next physical step only.`,
    `Do not reopen archived drains. Receipt: update this task description + basket.`,
  ].join(" ");
  return [
    `Human: ${item.why}`,
    `SSOT: ${ssot}`,
    `Resume: ${resume}`,
    `Links: https://dabos.logans.tools/open`,
    `Prompt: ${prompt}`,
    `Drain: ${item.id} · segment ${item.segment} · heat ${item.heat}`,
  ].join("\n");
}

function looksClosed(why: string): boolean {
  const head = why.slice(0, 120).toLowerCase();
  return (
    /^(done|closed|drained|cleared|handled|obsolete|superseded)\b/.test(head) ||
    /\b(done \/|— done|– done|\*\*done\*\*)\b/i.test(why.slice(0, 200))
  );
}

async function main() {
  const dry = process.argv.includes("--dry-run");
  const url = requireDatabaseUrl();
  const sql = createDabosSql(url);

  const snapPath = resolve(process.cwd(), "src/data/dabos-open-loops.json");
  const snap = JSON.parse(readFileSync(snapPath, "utf8")) as {
    hot: SnapItem[];
    open: SnapItem[];
    ship: SnapItem[];
  };
  const items = [...(snap.hot || []), ...(snap.open || []), ...(snap.ship || [])];

  const archivePath = join(
    dabosRoot(),
    "docs/reference/dept21-executive-director/founder-desk/OPEN-CHAT-BACKLOG-ARCHIVE.md"
  );
  const archive = existsSync(archivePath) ? readFileSync(archivePath, "utf8") : "";

  const depts = (await sql`SELECT id, division_id FROM departments`) as {
    id: string;
    division_id: string;
  }[];
  const divOf = new Map(depts.map((d) => [d.id, d.division_id]));

  let inserted = 0;
  let skipped = 0;
  let closed = 0;
  let updated = 0;

  for (const item of items) {
    const externalId = `chat-backlog:${item.id}`;
    const existing = (await sql`
      SELECT id::text, status, basket
      FROM tasks
      WHERE ingest_external_id = ${externalId}
      LIMIT 1
    `) as { id: string; status: string; basket: string }[];

    const inArchive = archive.includes(`## ${item.id}`);
    const shouldClose = inArchive || looksClosed(item.why);
    const dept = divOf.has(item.dept) ? item.dept : "Dept21";
    const divisionId = divOf.get(dept) || "Div7";
    const description = buildDescription(item);
    const title = `${item.id}: ${item.why}`.slice(0, 200);

    if (existing[0]) {
      skipped++;
      if (shouldClose && existing[0].status !== "done") {
        if (!dry) {
          await sql`
            UPDATE tasks
            SET status = 'done', basket = 'out', description = ${description}, updated_at = NOW()
            WHERE id = ${existing[0].id}::uuid
          `;
        }
        closed++;
        console.log("CLOSE", item.id, existing[0].id);
      }
      continue;
    }

    if (dry) {
      console.log(shouldClose ? "WOULD_INSERT_DONE" : "WOULD_INSERT", item.id, dept);
      inserted++;
      if (shouldClose) closed++;
      continue;
    }

    const status = shouldClose ? "done" : "todo";
    const basket = shouldClose ? "out" : "pending";
    const id = randomUUID();
    await sql`
      INSERT INTO tasks (
        id, title, description, status, basket, department_id, division_id,
        priority, assigned_agent, ingest_source, ingest_external_id, ingest_meta,
        created_at, updated_at
      ) VALUES (
        ${id}::uuid,
        ${title},
        ${description},
        ${status},
        ${basket},
        ${dept},
        ${divisionId},
        ${item.heat === "hot" ? 2 : 3},
        'human',
        'chat-backlog',
        ${externalId},
        ${JSON.stringify({
          drain_id: item.id,
          resume: item.resume,
          canonical: item.canonical,
          segment: item.segment,
          heat: item.heat,
          prompt: `Hat ${dept}. Resume: ${item.resume || item.id}. SSOT: ${item.canonical}`,
        })}::jsonb,
        NOW(),
        NOW()
      )
    `;
    inserted++;
    if (shouldClose) closed++;
    updated++;
    console.log(shouldClose ? "INSERT_DONE" : "INSERT", item.id, dept);
  }

  // Normalize legacy status=open → todo so /open board filter catches them
  if (!dry) {
    const norm = await sql`
      UPDATE tasks
      SET status = 'todo', updated_at = NOW()
      WHERE status = 'open'
      RETURNING id::text
    `;
    console.log("normalized_open_to_todo", norm.length);
  }

  console.log(
    JSON.stringify({ dry, total: items.length, inserted, skipped, closed_marked: closed, updated })
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
