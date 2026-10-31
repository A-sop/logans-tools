/**
 * The Dept1-inbox INSERT used by `npm run dabos:route`, split out so a PGlite test can run the
 * real statement (route.ts runs main() and loads .env.local on import).
 *
 * Dept1 intake rule: a captured tangent is agent work, never the founder's
 * (type 'agent', assigned_to NULL). Keep comments OUTSIDE the sql template: anything inside
 * it is sent to Postgres.
 */
import type { DabosSql } from '../../src/lib/dabos/dabos-connection';

export type RoutedCapture = {
  divisionId: string;
  title: string;
  description: string;
  externalId: string;
  meta: Record<string, unknown>;
};

export async function insertRoutedCapture(sql: DabosSql, c: RoutedCapture): Promise<string> {
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
      ${c.divisionId},
      ${'Dept1'},
      ${c.title},
      ${c.description},
      ${'agent'},
      ${'todo'},
      ${3},
      ${null},
      ${'in'},
      ${'api'},
      ${c.externalId},
      ${JSON.stringify(c.meta)}::jsonb
    )
    RETURNING id::text AS id
  `;
  return String(inserted[0].id);
}