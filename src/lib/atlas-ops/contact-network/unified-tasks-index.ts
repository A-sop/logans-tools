import Database from 'better-sqlite3';
import { buildDedupeKey } from '@/lib/atlas-ops/contact-network/unified-tasks-normalize';
import type {
  UnifiedTaskInput,
  UnifiedTaskRecord,
  UnifiedTaskSource,
  UnifiedTaskStatus,
  UnifiedTaskTriageStatus,
  UnifiedTasksImportReport,
} from '@/lib/atlas-ops/contact-network/unified-tasks-types';
import type { BookmarkReviewFilter } from '@/lib/atlas-ops/contact-network/bookmark-review-types';
import { BOOKMARK_IMPORT_NOTE, bookmarkReviewFromNotes } from '@/lib/atlas-ops/contact-network/bookmark-review-constants';

type UnifiedTaskRow = {
  id: number;
  source_system: string;
  external_id: string;
  title: string;
  status: string;
  due_date: string | null;
  url: string | null;
  list_name: string | null;
  priority: string | null;
  linear_issue_id: string | null;
  contact_id: number | null;
  notes: string | null;
  dedupe_key: string;
  duplicate_of: number | null;
  triage_status: string;
  imported_at: string;
  updated_at: string;
  bookmark_added_at: string | null;
  bookmark_quarter: string | null;
  link_status: string | null;
  link_checked_at: string | null;
  link_final_url: string | null;
  link_check_note: string | null;
  bookmark_review: string | null;
};

const SOURCE_PRIORITY: Record<UnifiedTaskSource, number> = {
  linear: 1,
  manual: 2,
  attio: 3,
  microsoft_todo: 4,
  bookmark: 5,
};

export class UnifiedTasksIndex {
  private readonly db: Database.Database;

  public constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.ensureSchema();
  }

  public close(): void {
    this.db.close();
  }

  public upsertTask(input: UnifiedTaskInput): number {
    const now = new Date().toISOString();
    const title = input.title.trim();
    if (!title) throw new Error('title is required');

    const dedupeKey = buildDedupeKey(title, input.dueDateIso, input.url);
    const statement = this.db.prepare(`
      INSERT INTO unified_tasks (
        source_system,
        external_id,
        title,
        status,
        due_date,
        url,
        list_name,
        priority,
        linear_issue_id,
        contact_id,
        notes,
        dedupe_key,
        duplicate_of,
        triage_status,
        imported_at,
        updated_at,
        bookmark_added_at,
        bookmark_quarter
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)
      ON CONFLICT(source_system, external_id) DO UPDATE SET
        title = excluded.title,
        status = excluded.status,
        due_date = excluded.due_date,
        url = excluded.url,
        list_name = excluded.list_name,
        priority = excluded.priority,
        linear_issue_id = excluded.linear_issue_id,
        contact_id = excluded.contact_id,
        notes = excluded.notes,
        dedupe_key = excluded.dedupe_key,
        triage_status = excluded.triage_status,
        bookmark_added_at = COALESCE(excluded.bookmark_added_at, bookmark_added_at),
        bookmark_quarter = COALESCE(excluded.bookmark_quarter, bookmark_quarter),
        updated_at = excluded.updated_at
    `);

    const result = statement.run(
      input.sourceSystem,
      input.externalId,
      title,
      input.status ?? 'open',
      input.dueDateIso ?? null,
      input.url?.trim() || null,
      input.listName?.trim() || null,
      input.priority?.trim() || null,
      input.linearIssueId?.trim() || null,
      input.contactId ?? null,
      input.notes?.trim() || null,
      dedupeKey,
      input.triageStatus ?? 'imported',
      now,
      now,
      input.bookmarkAddedAt ?? null,
      input.bookmarkQuarter ?? null
    );

    if (result.changes > 0 && result.lastInsertRowid > 0) {
      return Number(result.lastInsertRowid);
    }

    const existing = this.db
      .prepare(
        `
        SELECT id
        FROM unified_tasks
        WHERE source_system = ? AND external_id = ?
        LIMIT 1
      `
      )
      .get(input.sourceSystem, input.externalId) as { id: number } | undefined;

    if (!existing?.id) throw new Error('Failed to upsert unified task');
    return existing.id;
  }

  public runDedupePass(): number {
    const openRows = this.db
      .prepare(
        `
        SELECT id, source_system, dedupe_key, title, status, duplicate_of
        FROM unified_tasks
        WHERE status = 'open' AND duplicate_of IS NULL
        ORDER BY dedupe_key ASC, imported_at ASC, id ASC
      `
      )
      .all() as Array<{
      id: number;
      source_system: UnifiedTaskSource;
      dedupe_key: string;
      title: string;
    }>;

    const groups = new Map<string, typeof openRows>();
    for (const row of openRows) {
      const bucket = groups.get(row.dedupe_key) ?? [];
      bucket.push(row);
      groups.set(row.dedupe_key, bucket);
    }

    const markDuplicate = this.db.prepare(`
      UPDATE unified_tasks
      SET duplicate_of = ?, triage_status = 'needs_triage', updated_at = ?
      WHERE id = ?
    `);

    let marked = 0;
    const now = new Date().toISOString();

    for (const rows of groups.values()) {
      if (rows.length < 2) continue;

      const canonical = [...rows].sort((a, b) => {
        const priA = SOURCE_PRIORITY[a.source_system] ?? 99;
        const priB = SOURCE_PRIORITY[b.source_system] ?? 99;
        if (priA !== priB) return priA - priB;
        return a.id - b.id;
      })[0];

      for (const row of rows) {
        if (row.id === canonical.id) continue;
        markDuplicate.run(canonical.id, now, row.id);
        marked += 1;
      }
    }

    return marked;
  }

  public listTasks(options?: {
    status?: UnifiedTaskStatus;
    triageStatus?: UnifiedTaskTriageStatus;
    source?: UnifiedTaskSource;
    duplicatesOnly?: boolean;
    listNameContains?: string;
    excludeUrlContains?: string;
    canonicalOnly?: boolean;
    bookmarkQuarter?: string;
    bookmarkSort?: 'oldest' | 'newest';
    limit?: number;
  }): UnifiedTaskRecord[] {
    const clauses: string[] = [];
    const params: Array<string | number> = [];

    if (options?.status) {
      clauses.push('status = ?');
      params.push(options.status);
    }
    if (options?.triageStatus) {
      clauses.push('triage_status = ?');
      params.push(options.triageStatus);
    }
    if (options?.source) {
      clauses.push('source_system = ?');
      params.push(options.source);
    }
    if (options?.duplicatesOnly) {
      clauses.push('duplicate_of IS NOT NULL');
    }
    if (options?.canonicalOnly) {
      clauses.push('duplicate_of IS NULL');
    }
    if (options?.listNameContains) {
      clauses.push('list_name LIKE ?');
      params.push(`%${options.listNameContains}%`);
    }
    if (options?.excludeUrlContains) {
      clauses.push('(url IS NULL OR url NOT LIKE ?)');
      params.push(`%${options.excludeUrlContains}%`);
    }
    if (options?.bookmarkQuarter) {
      clauses.push('bookmark_quarter = ?');
      params.push(options.bookmarkQuarter);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const limit = options?.limit ?? 500;
    const bookmarkDateOrder =
      options?.bookmarkSort === 'newest'
        ? 'bookmark_added_at DESC'
        : 'bookmark_added_at ASC';
    const orderBy =
      options?.bookmarkQuarter || options?.source === 'bookmark'
        ? `
        duplicate_of IS NOT NULL,
        bookmark_added_at IS NULL,
        ${bookmarkDateOrder},
        title ASC`
        : `
        duplicate_of IS NOT NULL,
        due_date IS NULL,
        due_date ASC,
        source_system ASC,
        title ASC`;
    const statement = this.db.prepare(`
      SELECT *
      FROM unified_tasks
      ${where}
      ORDER BY ${orderBy}
      LIMIT ?
    `);

    const rows = statement.all(...params, limit) as UnifiedTaskRow[];
    return rows.map(mapRow);
  }

  public getDuplicatePairCounts(): Array<{
    loserSource: string;
    winnerSource: string;
    count: number;
  }> {
    const rows = this.db
      .prepare(
        `
        SELECT d.source_system AS loser_source, c.source_system AS winner_source, COUNT(*) AS n
        FROM unified_tasks d
        JOIN unified_tasks c ON c.id = d.duplicate_of
        WHERE d.duplicate_of IS NOT NULL
        GROUP BY loser_source, winner_source
        ORDER BY n DESC
      `
      )
      .all() as Array<{ loser_source: string; winner_source: string; n: number }>;

    return rows.map((row) => ({
      loserSource: row.loser_source,
      winnerSource: row.winner_source,
      count: row.n,
    }));
  }

  public getTopDuplicateClusters(limit = 100): Array<{
    canonicalId: number;
    canonicalSource: string;
    canonicalTitle: string;
    canonicalUrl: string | null;
    canonicalLinear: string | null;
    duplicateCount: number;
    loserSources: string;
  }> {
    const rows = this.db
      .prepare(
        `
        SELECT
          c.id AS canonical_id,
          c.source_system AS canonical_source,
          c.title AS canonical_title,
          c.url AS canonical_url,
          c.linear_issue_id AS canonical_linear,
          COUNT(d.id) AS duplicate_count,
          GROUP_CONCAT(DISTINCT d.source_system) AS loser_sources
        FROM unified_tasks c
        JOIN unified_tasks d ON d.duplicate_of = c.id
        GROUP BY c.id
        ORDER BY duplicate_count DESC, c.source_system ASC
        LIMIT ?
      `
      )
      .all(limit) as Array<{
      canonical_id: number;
      canonical_source: string;
      canonical_title: string;
      canonical_url: string | null;
      canonical_linear: string | null;
      duplicate_count: number;
      loser_sources: string;
    }>;

    return rows.map((row) => ({
      canonicalId: row.canonical_id,
      canonicalSource: row.canonical_source,
      canonicalTitle: row.canonical_title,
      canonicalUrl: row.canonical_url,
      canonicalLinear: row.canonical_linear,
      duplicateCount: row.duplicate_count,
      loserSources: row.loser_sources,
    }));
  }

  public archiveTasks(filter: {
    source?: UnifiedTaskSource;
    duplicatesOnly?: boolean;
    ids?: number[];
    triageStatus?: UnifiedTaskTriageStatus;
    listNameContains?: string;
    excludeUrlContains?: string;
    canonicalOnly?: boolean;
  }): number {
    const now = new Date().toISOString();
    const clauses: string[] = ["status = 'open'"];
    const params: Array<string | number> = [];

    if (filter.source) {
      clauses.push('source_system = ?');
      params.push(filter.source);
    }
    if (filter.duplicatesOnly) {
      clauses.push('duplicate_of IS NOT NULL');
    }
    if (filter.canonicalOnly) {
      clauses.push('duplicate_of IS NULL');
    }
    if (filter.triageStatus) {
      clauses.push('triage_status = ?');
      params.push(filter.triageStatus);
    }
    if (filter.listNameContains) {
      clauses.push('list_name LIKE ?');
      params.push(`%${filter.listNameContains}%`);
    }
    if (filter.excludeUrlContains) {
      clauses.push('(url IS NULL OR url NOT LIKE ?)');
      params.push(`%${filter.excludeUrlContains}%`);
    }
    if (filter.ids && filter.ids.length > 0) {
      const placeholders = filter.ids.map(() => '?').join(', ');
      clauses.push(`id IN (${placeholders})`);
      params.push(...filter.ids);
    }

    const statement = this.db.prepare(`
      UPDATE unified_tasks
      SET status = 'done', triage_status = 'archived', updated_at = ?
      WHERE ${clauses.join(' AND ')}
    `);

    const result = statement.run(now, ...params);
    return result.changes;
  }

  public buildReport(sourcesAttempted: UnifiedTaskSource[]): UnifiedTasksImportReport {
    const bySourceRows = this.db
      .prepare(
        `
        SELECT source_system, COUNT(*) AS count
        FROM unified_tasks
        GROUP BY source_system
      `
      )
      .all() as Array<{ source_system: string; count: number }>;

    const byStatusRows = this.db
      .prepare(
        `
        SELECT status, COUNT(*) AS count
        FROM unified_tasks
        GROUP BY status
      `
      )
      .all() as Array<{ status: string; count: number }>;

    const byTriageRows = this.db
      .prepare(
        `
        SELECT triage_status, COUNT(*) AS count
        FROM unified_tasks
        GROUP BY triage_status
      `
      )
      .all() as Array<{ triage_status: string; count: number }>;

    const duplicateCount = (
      this.db
        .prepare(`SELECT COUNT(*) AS count FROM unified_tasks WHERE duplicate_of IS NOT NULL`)
        .get() as { count: number }
    ).count;

    const openCount = (
      this.db.prepare(`SELECT COUNT(*) AS count FROM unified_tasks WHERE status = 'open'`).get() as {
        count: number;
      }
    ).count;

    const duplicateGroups = this.db
      .prepare(
        `
        SELECT dedupe_key, COUNT(*) AS count
        FROM unified_tasks
        WHERE status = 'open'
        GROUP BY dedupe_key
        HAVING COUNT(*) > 1
        ORDER BY count DESC
        LIMIT 15
      `
      )
      .all() as Array<{ dedupe_key: string; count: number }>;

    const topDuplicateGroups = duplicateGroups.map((group) => {
      const rows = this.db
        .prepare(
          `
          SELECT title, source_system
          FROM unified_tasks
          WHERE dedupe_key = ? AND status = 'open'
          ORDER BY id ASC
          LIMIT 8
        `
        )
        .all(group.dedupe_key) as Array<{ title: string; source_system: string }>;

      return {
        dedupeKey: group.dedupe_key,
        count: group.count,
        titles: rows.map((row) => row.title),
        sources: rows.map((row) => row.source_system),
      };
    });

    return {
      importedAt: new Date().toISOString(),
      sourcesAttempted,
      counts: {
        bySource: Object.fromEntries(bySourceRows.map((row) => [row.source_system, row.count])),
        byStatus: Object.fromEntries(byStatusRows.map((row) => [row.status, row.count])),
        byTriageStatus: Object.fromEntries(byTriageRows.map((row) => [row.triage_status, row.count])),
        duplicates: duplicateCount,
        open: openCount,
      },
      missingInputs: [],
      topDuplicateGroups,
    };
  }

  private ensureSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS unified_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_system TEXT NOT NULL CHECK(source_system IN ('linear', 'microsoft_todo', 'attio', 'bookmark', 'manual')),
        external_id TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('open', 'done', 'canceled')),
        due_date TEXT,
        url TEXT,
        list_name TEXT,
        priority TEXT,
        linear_issue_id TEXT,
        contact_id INTEGER,
        notes TEXT,
        dedupe_key TEXT NOT NULL,
        duplicate_of INTEGER,
        triage_status TEXT NOT NULL CHECK(triage_status IN ('imported', 'needs_triage', 'promoted', 'archived')),
        imported_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(source_system, external_id),
        FOREIGN KEY(contact_id) REFERENCES contacts(id) ON DELETE SET NULL,
        FOREIGN KEY(duplicate_of) REFERENCES unified_tasks(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_unified_tasks_dedupe
      ON unified_tasks(dedupe_key);

      CREATE INDEX IF NOT EXISTS idx_unified_tasks_status_triage
      ON unified_tasks(status, triage_status);

      CREATE INDEX IF NOT EXISTS idx_unified_tasks_duplicate
      ON unified_tasks(duplicate_of);
    `);

    const columns = this.db
      .prepare(`PRAGMA table_info(unified_tasks)`)
      .all() as Array<{ name: string }>;
    const columnNames = new Set(columns.map((column) => column.name));
    if (!columnNames.has('bookmark_added_at')) {
      this.db.exec(`ALTER TABLE unified_tasks ADD COLUMN bookmark_added_at TEXT`);
    }
    if (!columnNames.has('bookmark_quarter')) {
      this.db.exec(`ALTER TABLE unified_tasks ADD COLUMN bookmark_quarter TEXT`);
    }
    if (!columnNames.has('link_status')) {
      this.db.exec(`ALTER TABLE unified_tasks ADD COLUMN link_status TEXT`);
    }
    if (!columnNames.has('link_checked_at')) {
      this.db.exec(`ALTER TABLE unified_tasks ADD COLUMN link_checked_at TEXT`);
    }
    if (!columnNames.has('link_final_url')) {
      this.db.exec(`ALTER TABLE unified_tasks ADD COLUMN link_final_url TEXT`);
    }
    if (!columnNames.has('link_check_note')) {
      this.db.exec(`ALTER TABLE unified_tasks ADD COLUMN link_check_note TEXT`);
    }
    if (!columnNames.has('bookmark_review')) {
      this.db.exec(`ALTER TABLE unified_tasks ADD COLUMN bookmark_review TEXT`);
    }
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_unified_tasks_bookmark_quarter
      ON unified_tasks(bookmark_quarter);
      CREATE INDEX IF NOT EXISTS idx_unified_tasks_bookmark_review
      ON unified_tasks(source_system, status, triage_status, bookmark_review);
    `);

    this.db
      .prepare(
        `
        UPDATE unified_tasks SET bookmark_review = 'noted'
        WHERE source_system = 'bookmark' AND bookmark_review = 'later'
      `
      )
      .run();
    this.db
      .prepare(
        `
        UPDATE unified_tasks SET bookmark_review = 'noted'
        WHERE source_system = 'bookmark' AND status = 'open' AND triage_status = 'needs_triage'
          AND (bookmark_review IS NULL OR bookmark_review = 'pending')
          AND notes IS NOT NULL AND TRIM(notes) != '' AND notes != ?
      `
      )
      .run(BOOKMARK_IMPORT_NOTE);
  }

  public getBookmarkById(id: number): UnifiedTaskRecord | null {
    const row = this.db.prepare(`SELECT * FROM unified_tasks WHERE id = ? AND source_system = 'bookmark'`).get(id) as
      | UnifiedTaskRow
      | undefined;
    return row ? mapRow(row) : null;
  }

  public getBookmarkReviewStats(): { todo: number; noted: number; kept: number; totalOpen: number } {
    const todo = (
      this.db
        .prepare(
          `
        SELECT COUNT(*) AS count FROM unified_tasks
        WHERE source_system = 'bookmark' AND status = 'open' AND duplicate_of IS NULL
          AND triage_status = 'needs_triage'
          AND (bookmark_review IS NULL OR bookmark_review = 'pending')
      `
        )
        .get() as { count: number }
    ).count;
    const noted = (
      this.db
        .prepare(
          `
        SELECT COUNT(*) AS count FROM unified_tasks
        WHERE source_system = 'bookmark' AND status = 'open' AND duplicate_of IS NULL
          AND triage_status = 'needs_triage' AND bookmark_review = 'noted'
      `
        )
        .get() as { count: number }
    ).count;
    const kept = (
      this.db
        .prepare(
          `
        SELECT COUNT(*) AS count FROM unified_tasks
        WHERE source_system = 'bookmark' AND duplicate_of IS NULL
          AND (triage_status = 'promoted' OR bookmark_review = 'keep')
      `
        )
        .get() as { count: number }
    ).count;
    const totalOpen = (
      this.db
        .prepare(
          `
        SELECT COUNT(*) AS count FROM unified_tasks
        WHERE source_system = 'bookmark' AND status = 'open' AND duplicate_of IS NULL
      `
        )
        .get() as { count: number }
    ).count;
    return { todo, noted, kept, totalOpen };
  }

  private bookmarkReviewWhere(filter: BookmarkReviewFilter): string {
    const base = "source_system = 'bookmark' AND duplicate_of IS NULL";
    switch (filter) {
      case 'todo':
        return `${base} AND status = 'open' AND triage_status = 'needs_triage' AND (bookmark_review IS NULL OR bookmark_review = 'pending')`;
      case 'noted':
        return `${base} AND status = 'open' AND triage_status = 'needs_triage' AND bookmark_review = 'noted'`;
      case 'kept':
        return `${base} AND (triage_status = 'promoted' OR bookmark_review = 'keep')`;
      case 'all':
      default:
        return `${base} AND status = 'open' AND triage_status IN ('needs_triage', 'imported')`;
    }
  }

  public listBookmarkReviewQueue(
    filter: BookmarkReviewFilter,
    limit: number,
    offset: number
  ): { items: UnifiedTaskRecord[]; total: number } {
    const where = this.bookmarkReviewWhere(filter);
    const total = (
      this.db.prepare(`SELECT COUNT(*) AS count FROM unified_tasks WHERE ${where}`).get() as { count: number }
    ).count;
    const rows = this.db
      .prepare(
        `
        SELECT * FROM unified_tasks
        WHERE ${where}
        ORDER BY
          bookmark_added_at IS NULL,
          bookmark_added_at ASC,
          imported_at ASC,
          id ASC
        LIMIT ? OFFSET ?
      `
      )
      .all(limit, offset) as UnifiedTaskRow[];
    return { items: rows.map(mapRow), total };
  }

  public updateBookmarkNotes(id: number, notes: string): UnifiedTaskRecord | null {
    const now = new Date().toISOString();
    const review = bookmarkReviewFromNotes(notes);
    const result = this.db
      .prepare(
        `
        UPDATE unified_tasks
        SET notes = ?, bookmark_review = ?, updated_at = ?
        WHERE id = ? AND source_system = 'bookmark' AND status = 'open' AND triage_status = 'needs_triage'
      `
      )
      .run(notes, review, now, id);
    if (result.changes === 0) return null;
    return this.getBookmarkById(id);
  }

  public updateBookmarkLinkCheck(
    id: number,
    link: {
      linkStatus: string;
      linkCheckedAt: string;
      linkFinalUrl: string | null;
      linkCheckNote: string;
    }
  ): UnifiedTaskRecord | null {
    const now = new Date().toISOString();
    const result = this.db
      .prepare(
        `
        UPDATE unified_tasks
        SET link_status = ?, link_checked_at = ?, link_final_url = ?, link_check_note = ?, updated_at = ?
        WHERE id = ? AND source_system = 'bookmark'
      `
      )
      .run(link.linkStatus, link.linkCheckedAt, link.linkFinalUrl, link.linkCheckNote, now, id);
    if (result.changes === 0) return null;
    return this.getBookmarkById(id);
  }

  public applyBookmarkReviewDecision(
    id: number,
    decision: 'keep' | 'delete',
    notes?: string | null
  ): UnifiedTaskRecord | null {
    const now = new Date().toISOString();
    let triageStatus: UnifiedTaskTriageStatus = 'needs_triage';
    let status: UnifiedTaskStatus = 'open';
    let bookmarkReview: string;

    if (decision === 'keep') {
      triageStatus = 'promoted';
      bookmarkReview = 'keep';
    } else {
      triageStatus = 'archived';
      status = 'done';
      bookmarkReview = 'delete';
    }

    const result = this.db
      .prepare(
        `
        UPDATE unified_tasks
        SET triage_status = ?, status = ?, bookmark_review = ?,
            notes = COALESCE(?, notes), updated_at = ?
        WHERE id = ? AND source_system = 'bookmark'
      `
      )
      .run(triageStatus, status, bookmarkReview, notes ?? null, now, id);
    if (result.changes === 0) return null;
    return this.getBookmarkById(id);
  }

  public getBookmarkQuarterSummary(options?: {
    status?: UnifiedTaskStatus;
    triageStatus?: UnifiedTaskTriageStatus;
    canonicalOnly?: boolean;
  }): Array<{ quarter: string; count: number; oldest: string | null; newest: string | null }> {
    const clauses = ["source_system = 'bookmark'"];
    const params: Array<string> = [];

    if (options?.status) {
      clauses.push('status = ?');
      params.push(options.status);
    }
    if (options?.triageStatus) {
      clauses.push('triage_status = ?');
      params.push(options.triageStatus);
    }
    if (options?.canonicalOnly) {
      clauses.push('duplicate_of IS NULL');
    }

    const where = `WHERE ${clauses.join(' AND ')}`;
    const rows = this.db
      .prepare(
        `
        SELECT
          COALESCE(bookmark_quarter, 'unknown') AS quarter,
          COUNT(*) AS count,
          MIN(bookmark_added_at) AS oldest,
          MAX(bookmark_added_at) AS newest
        FROM unified_tasks
        ${where}
        GROUP BY COALESCE(bookmark_quarter, 'unknown')
        ORDER BY quarter ASC
      `
      )
      .all(...params) as Array<{
      quarter: string;
      count: number;
      oldest: string | null;
      newest: string | null;
    }>;

    return rows;
  }
}

function mapRow(row: UnifiedTaskRow): UnifiedTaskRecord {
  return {
    id: row.id,
    sourceSystem: row.source_system as UnifiedTaskSource,
    externalId: row.external_id,
    title: row.title,
    status: row.status as UnifiedTaskStatus,
    dueDate: row.due_date,
    url: row.url,
    listName: row.list_name,
    priority: row.priority,
    linearIssueId: row.linear_issue_id,
    contactId: row.contact_id,
    notes: row.notes,
    dedupeKey: row.dedupe_key,
    duplicateOf: row.duplicate_of,
    triageStatus: row.triage_status as UnifiedTaskTriageStatus,
    importedAt: row.imported_at,
    updatedAt: row.updated_at,
    bookmarkAddedAt: row.bookmark_added_at ?? null,
    bookmarkQuarter: row.bookmark_quarter ?? null,
    linkStatus: row.link_status ?? null,
    linkCheckedAt: row.link_checked_at ?? null,
    linkFinalUrl: row.link_final_url ?? null,
    linkCheckNote: row.link_check_note ?? null,
    bookmarkReview: row.bookmark_review ?? null,
  };
}
