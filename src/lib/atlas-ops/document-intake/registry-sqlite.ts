import Database from 'better-sqlite3';
import { resolveEffectiveFiling } from '@/lib/atlas-ops/document-intake/review-filing';
import type { DocRole, NamingTrack, ProcessingState, ProposedBucket, RegistryClassification } from '@/lib/atlas-ops/document-intake/types';

export interface RegistryEntryRecord {
  sourcePath: string;
  sourceFileName: string;
  fileHash: string;
  fileSizeBytes: number;
  mimeType: string;
  detectedType: string;
  lifecycleStatus: ProcessingState;
  classificationJson: string;
  confidence: number;
  warningsJson: string;
  docRole: DocRole;
  proposedBucket: ProposedBucket;
  proposedRelativePath: string;
  namingTrack: NamingTrack;
  proposedBasename: string;
  displayTitle: string;
  namingConfidence: number;
  approved: 'pending' | 'Y' | 'N' | 'L' | 'flag';
  reviewNotes: string | null;
  inventoryPolicy: string | null;
  errorMessage: string | null;
  processedAtIso: string;
}

export interface RegistryReviewRow {
  source_path: string;
  current_filename: string;
  display_title: string;
  summary: string;
  doc_role: string;
  proposed_bucket: string;
  proposed_relative_path: string;
  proposed_basename: string;
  naming_track: string;
  confidence: number;
  naming_confidence: number;
  warnings: string;
  lifecycle_status: string;
  approved: string;
  review_notes: string;
  detected_type: string;
  review_keep_filename: number;
  review_basename_override: string;
  review_relative_path_override: string;
  organization: string;
  anbieter: string;
  classification_json: string;
}

export type FilingRuleStatus = 'draft' | 'confirmed';

export interface RegistryFilingRuleRow {
  id: number;
  rule_kind: string;
  match_value: string;
  keep_filename: number;
  target_basename: string;
  target_relative_path: string;
  support_count: number;
  example_source_path: string;
  last_notes: string;
  rule_status: FilingRuleStatus;
}

export interface ApprovedApplyRow {
  source_path: string;
  proposed_basename: string;
  proposed_relative_path: string;
  approved: string;
  effective_basename: string;
  effective_relative_path: string;
}

const REVIEW_ROW_SELECT = `
  SELECT source_path, source_file_name AS current_filename, display_title,
         json_extract(classification_json, '$.summary') AS summary,
         COALESCE(json_extract(classification_json, '$.organization'), 'UnknownOrg') AS organization,
         COALESCE(json_extract(classification_json, '$.enrichment.anbieter'), '') AS anbieter,
         classification_json,
         doc_role, proposed_bucket, proposed_relative_path, proposed_basename, naming_track,
         confidence, naming_confidence, warnings_json AS warnings, lifecycle_status, approved,
         COALESCE(review_notes, '') AS review_notes, detected_type,
         COALESCE(review_keep_filename, 0) AS review_keep_filename,
         COALESCE(review_basename_override, '') AS review_basename_override,
         COALESCE(review_relative_path_override, '') AS review_relative_path_override
  FROM registry_entries
`;

export type ReviewQueueFilter = 'todo' | 'admin' | 'later' | 'noted' | 'decided' | 'all';

const PRE_ADMIN_SCOPE = `source_path NOT LIKE 'C:\\DATA\\20_ADMIN%'`;
const ADMIN_SCOPE = `source_path LIKE 'C:\\DATA\\20_ADMIN%'`;

export class DocumentRegistryIndex {
  private readonly db: Database.Database;

  public constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.ensureSchema();
  }

  public close(): void {
    this.db.close();
  }

  public hasPath(sourcePath: string): boolean {
    const row = this.db.prepare('SELECT id FROM registry_entries WHERE source_path = ? LIMIT 1').get(sourcePath) as
      | { id: number }
      | undefined;
    return Boolean(row?.id);
  }

  public hasHash(fileHash: string): boolean {
    const row = this.db.prepare('SELECT id FROM registry_entries WHERE file_hash = ? LIMIT 1').get(fileHash) as
      | { id: number }
      | undefined;
    return Boolean(row?.id);
  }

  public getFirstPathForHash(fileHash: string): string | null {
    const row = this.db
      .prepare('SELECT source_path FROM registry_entries WHERE file_hash = ? ORDER BY id ASC LIMIT 1')
      .get(fileHash) as { source_path: string } | undefined;
    return row?.source_path ?? null;
  }

  public upsertEntry(record: RegistryEntryRecord): void {
    this.db
      .prepare(
        `
      INSERT INTO registry_entries (
        source_path, source_file_name, file_hash, file_size_bytes, mime_type, detected_type,
        lifecycle_status, classification_json, confidence, warnings_json,
        doc_role, proposed_bucket, proposed_relative_path, naming_track, proposed_basename,
        display_title, naming_confidence, approved, inventory_policy, error_message, processed_at, created_at
      ) VALUES (
        @sourcePath, @sourceFileName, @fileHash, @fileSizeBytes, @mimeType, @detectedType,
        @lifecycleStatus, @classificationJson, @confidence, @warningsJson,
        @docRole, @proposedBucket, @proposedRelativePath, @namingTrack, @proposedBasename,
        @displayTitle, @namingConfidence, @approved, @inventoryPolicy, @errorMessage, @processedAtIso, datetime('now')
      )
      ON CONFLICT(source_path) DO UPDATE SET
        source_file_name=excluded.source_file_name,
        file_hash=excluded.file_hash,
        file_size_bytes=excluded.file_size_bytes,
        mime_type=excluded.mime_type,
        detected_type=excluded.detected_type,
        lifecycle_status=excluded.lifecycle_status,
        classification_json=excluded.classification_json,
        confidence=excluded.confidence,
        warnings_json=excluded.warnings_json,
        doc_role=excluded.doc_role,
        proposed_bucket=excluded.proposed_bucket,
        proposed_relative_path=excluded.proposed_relative_path,
        naming_track=excluded.naming_track,
        proposed_basename=excluded.proposed_basename,
        display_title=excluded.display_title,
        naming_confidence=excluded.naming_confidence,
        inventory_policy=excluded.inventory_policy,
        error_message=excluded.error_message,
        processed_at=excluded.processed_at
    `
      )
      .run(record);
  }

  public listForReviewExport(statusFilter: ProcessingState | 'all' = 'review_required'): RegistryReviewRow[] {
    const sql =
      statusFilter === 'all'
        ? `${REVIEW_ROW_SELECT} ORDER BY confidence ASC, naming_confidence ASC`
        : `${REVIEW_ROW_SELECT} WHERE lifecycle_status = ? ORDER BY confidence ASC, naming_confidence ASC`;
    return statusFilter === 'all'
      ? (this.db.prepare(sql).all() as RegistryReviewRow[])
      : (this.db.prepare(sql).all(statusFilter) as RegistryReviewRow[]);
  }

  public listAllEntries(): RegistryReviewRow[] {
    return this.listForReviewExport('all');
  }

  public updateApproved(sourcePath: string, approved: 'pending' | 'Y' | 'N' | 'L' | 'flag'): void {
    this.db.prepare('UPDATE registry_entries SET approved = ? WHERE source_path = ?').run(approved, sourcePath);
  }

  public updateReviewDecision(
    sourcePath: string,
    approved: 'pending' | 'Y' | 'N' | 'L' | 'flag',
    reviewNotes: string | null,
    filing: {
      keepFilename: boolean;
      basenameOverride: string;
      relativePathOverride: string;
    }
  ): void {
    const decidedAt =
      approved === 'Y' || approved === 'N' || approved === 'L' || approved === 'flag' ? new Date().toISOString() : null;
    this.db
      .prepare(
        `UPDATE registry_entries SET
          approved = ?,
          review_notes = ?,
          review_keep_filename = ?,
          review_basename_override = ?,
          review_relative_path_override = ?,
          review_decided_at = COALESCE(?, review_decided_at)
        WHERE source_path = ?`
      )
      .run(
        approved,
        reviewNotes ?? '',
        filing.keepFilename ? 1 : 0,
        filing.basenameOverride,
        filing.relativePathOverride,
        decidedAt,
        sourcePath
      );
  }

  public countDecidedTodayLocal(): number {
    return (
      this.db
        .prepare(
          `
      SELECT COUNT(*) AS c
      FROM registry_entries
      WHERE approved IN ('Y', 'N', 'L', 'flag')
        AND review_decided_at IS NOT NULL
        AND review_decided_at != ''
        AND date(review_decided_at) = date('now', 'localtime')
    `
        )
        .get() as { c: number }
    ).c;
  }

  public getReviewEntry(sourcePath: string): RegistryReviewRow | null {
    const row = this.db.prepare(`${REVIEW_ROW_SELECT} WHERE source_path = ? LIMIT 1`).get(sourcePath) as
      | RegistryReviewRow
      | undefined;
    return row ?? null;
  }

  public countReviewQueue(filter: ReviewQueueFilter = 'todo'): number {
    let where = '';
    switch (filter) {
      case 'todo':
        // Riffed rows live in 'noted' ONLY — once Logan writes a note, the
        // file has been handled and must leave To-review (his 2026-07-12 rule).
        where = `WHERE lifecycle_status = 'review_required' AND approved IN ('pending', '') AND TRIM(COALESCE(review_notes, '')) = '' AND ${PRE_ADMIN_SCOPE}`;
        break;
      case 'admin':
        where = `WHERE lifecycle_status = 'review_required' AND approved IN ('pending', '') AND ${ADMIN_SCOPE}`;
        break;
      case 'later':
        where = `WHERE approved = 'L'`;
        break;
      case 'noted':
        where = `WHERE lifecycle_status = 'review_required' AND approved IN ('pending', '') AND TRIM(COALESCE(review_notes, '')) != '' AND ${PRE_ADMIN_SCOPE}`;
        break;
      case 'decided':
        where = `WHERE approved IN ('Y', 'N', 'flag')`;
        break;
      case 'all':
        where = '';
        break;
    }
    const sql = `SELECT COUNT(*) AS c FROM registry_entries ${where}`;
    return (this.db.prepare(sql).get() as { c: number }).c;
  }

  public listReviewQueue(filter: ReviewQueueFilter = 'todo', limit?: number, offset = 0): RegistryReviewRow[] {
    const baseSelect = REVIEW_ROW_SELECT;

    let where = '';
    switch (filter) {
      case 'todo':
        // Keep in sync with countReviewQueue: noted rows are handled rows.
        where = `WHERE lifecycle_status = 'review_required' AND approved IN ('pending', '') AND TRIM(COALESCE(review_notes, '')) = '' AND ${PRE_ADMIN_SCOPE}`;
        break;
      case 'admin':
        where = `WHERE lifecycle_status = 'review_required' AND approved IN ('pending', '') AND ${ADMIN_SCOPE}`;
        break;
      case 'later':
        where = `WHERE approved = 'L'`;
        break;
      case 'noted':
        where = `WHERE lifecycle_status = 'review_required' AND approved IN ('pending', '') AND TRIM(COALESCE(review_notes, '')) != '' AND ${PRE_ADMIN_SCOPE}`;
        break;
      case 'decided':
        where = `WHERE approved IN ('Y', 'N', 'flag')`;
        break;
      case 'all':
        where = '';
        break;
    }

    const safeOffset = Math.max(0, Math.floor(offset));
    const offsetClause = safeOffset > 0 ? ` OFFSET ${safeOffset}` : '';
    const limitClause = limit && limit > 0 ? ` LIMIT ${Math.floor(limit)}` : '';
    const orderBy =
      filter === 'admin'
        ? ` ORDER BY CASE WHEN source_path LIKE '%!_TAXES-2026%' THEN 0 ELSE 1 END, confidence ASC, naming_confidence ASC, source_path ASC`
        : ` ORDER BY confidence ASC, naming_confidence ASC, source_path ASC`;
    const sql = `${baseSelect} ${where}${orderBy}${limitClause}${offsetClause}`;
    return this.db.prepare(sql).all() as RegistryReviewRow[];
  }

  public getReviewDecisionStats(): {
    todo: number;
    noted: number;
    admin: number;
    later: number;
    yes: number;
    no: number;
    flag: number;
    total: number;
  } {
    const total = (this.db.prepare('SELECT COUNT(*) AS c FROM registry_entries').get() as { c: number }).c;
    const todo = (
      this.db
        .prepare(
          // Noted rows are handled — excluded here exactly as in countReviewQueue('todo').
          `SELECT COUNT(*) AS c FROM registry_entries WHERE lifecycle_status = 'review_required' AND approved IN ('pending', '') AND TRIM(COALESCE(review_notes, '')) = '' AND ${PRE_ADMIN_SCOPE}`
        )
        .get() as { c: number }
    ).c;
    const noted = (
      this.db
        .prepare(
          `SELECT COUNT(*) AS c FROM registry_entries WHERE lifecycle_status = 'review_required' AND approved IN ('pending', '') AND TRIM(COALESCE(review_notes, '')) != '' AND ${PRE_ADMIN_SCOPE}`
        )
        .get() as { c: number }
    ).c;
    const admin = (
      this.db
        .prepare(
          `SELECT COUNT(*) AS c FROM registry_entries WHERE lifecycle_status = 'review_required' AND approved IN ('pending', '') AND ${ADMIN_SCOPE}`
        )
        .get() as { c: number }
    ).c;
    const later = (
      this.db.prepare(`SELECT COUNT(*) AS c FROM registry_entries WHERE approved = 'L'`).get() as { c: number }
    ).c;
    const yes = (
      this.db.prepare(`SELECT COUNT(*) AS c FROM registry_entries WHERE approved = 'Y'`).get() as { c: number }
    ).c;
    const no = (
      this.db.prepare(`SELECT COUNT(*) AS c FROM registry_entries WHERE approved = 'N'`).get() as { c: number }
    ).c;
    const flag = (
      this.db.prepare(`SELECT COUNT(*) AS c FROM registry_entries WHERE approved = 'flag'`).get() as { c: number }
    ).c;
    return { todo, noted, admin, later, yes, no, flag, total };
  }

  public getApprovedForApply(): ApprovedApplyRow[] {
    const rows = this.db
      .prepare(
        `
      SELECT source_path, proposed_basename, proposed_relative_path, approved,
             source_file_name AS current_filename,
             COALESCE(review_keep_filename, 0) AS review_keep_filename,
             COALESCE(review_basename_override, '') AS review_basename_override,
             COALESCE(review_relative_path_override, '') AS review_relative_path_override
      FROM registry_entries
      WHERE approved = 'Y'
      ORDER BY source_path
    `
      )
      .all() as Array<{
      source_path: string;
      proposed_basename: string;
      proposed_relative_path: string;
      approved: string;
      current_filename: string;
      review_keep_filename: number;
      review_basename_override: string;
      review_relative_path_override: string;
    }>;

    return rows.map((row) => {
      const resolved = resolveEffectiveFiling({
        sourcePath: row.source_path,
        proposedBasename: row.proposed_basename,
        proposedRelativePath: row.proposed_relative_path,
        keepFilename: row.review_keep_filename === 1,
        basenameOverride: row.review_basename_override,
        relativePathOverride: row.review_relative_path_override,
      });
      return {
        source_path: row.source_path,
        proposed_basename: row.proposed_basename,
        proposed_relative_path: row.proposed_relative_path,
        approved: row.approved,
        effective_basename: resolved.basename,
        effective_relative_path: resolved.relativePath,
      };
    });
  }

  public upsertFilingRule(input: {
    ruleKind: string;
    matchValue: string;
    keepFilename: number;
    targetBasename: string;
    targetRelativePath: string;
    exampleSourcePath: string;
    lastNotes: string;
    ruleStatus?: FilingRuleStatus;
  }): void {
    const ruleStatus = input.ruleStatus ?? 'confirmed';
    this.db
      .prepare(
        `
      INSERT INTO registry_filing_rules (
        rule_kind, match_value, keep_filename, target_basename, target_relative_path,
        support_count, example_source_path, last_notes, rule_status, created_at, updated_at
      ) VALUES (
        @ruleKind, @matchValue, @keepFilename, @targetBasename, @targetRelativePath,
        1, @exampleSourcePath, @lastNotes, @ruleStatus, datetime('now'), datetime('now')
      )
      ON CONFLICT(rule_kind, match_value) DO UPDATE SET
        keep_filename = CASE
          WHEN registry_filing_rules.rule_status = 'confirmed' AND excluded.rule_status = 'draft'
            THEN registry_filing_rules.keep_filename
          ELSE excluded.keep_filename
        END,
        target_basename = CASE
          WHEN registry_filing_rules.rule_status = 'confirmed' AND excluded.rule_status = 'draft'
            THEN registry_filing_rules.target_basename
          ELSE excluded.target_basename
        END,
        target_relative_path = CASE
          WHEN registry_filing_rules.rule_status = 'confirmed' AND excluded.rule_status = 'draft'
            THEN registry_filing_rules.target_relative_path
          ELSE excluded.target_relative_path
        END,
        support_count = CASE
          WHEN excluded.rule_status = 'confirmed' THEN registry_filing_rules.support_count + 1
          WHEN registry_filing_rules.rule_status = 'confirmed' THEN registry_filing_rules.support_count
          ELSE registry_filing_rules.support_count + 1
        END,
        example_source_path = excluded.example_source_path,
        last_notes = excluded.last_notes,
        rule_status = CASE
          WHEN excluded.rule_status = 'confirmed' THEN 'confirmed'
          WHEN registry_filing_rules.rule_status = 'confirmed' THEN 'confirmed'
          ELSE 'draft'
        END,
        updated_at = datetime('now')
    `
      )
      .run({
        ruleKind: input.ruleKind,
        matchValue: input.matchValue,
        keepFilename: input.keepFilename,
        targetBasename: input.targetBasename,
        targetRelativePath: input.targetRelativePath,
        exampleSourcePath: input.exampleSourcePath,
        lastNotes: input.lastNotes,
        ruleStatus,
      });
  }

  public findFilingRule(ruleKind: string, matchValue: string): RegistryFilingRuleRow | null {
    const row = this.db
      .prepare(
        `
      SELECT id, rule_kind, match_value, keep_filename, target_basename, target_relative_path,
             support_count, example_source_path, last_notes, rule_status
      FROM registry_filing_rules
      WHERE rule_kind = ? AND match_value = ?
      ORDER BY CASE rule_status WHEN 'confirmed' THEN 0 ELSE 1 END, support_count DESC
      LIMIT 1
    `
      )
      .get(ruleKind, matchValue) as RegistryFilingRuleRow | undefined;
    return row ?? null;
  }

  public findFilingRuleForFilename(filename: string): RegistryFilingRuleRow | null {
    return this.findFilingRule('filename_exact', filename.toLowerCase());
  }

  public listFilingRules(): RegistryFilingRuleRow[] {
    return this.db
      .prepare(
        `
      SELECT id, rule_kind, match_value, keep_filename, target_basename, target_relative_path,
             support_count, example_source_path, last_notes, rule_status
      FROM registry_filing_rules
      ORDER BY support_count DESC, updated_at DESC
    `
      )
      .all() as RegistryFilingRuleRow[];
  }

  public getPilotStats(): {
    total: number;
    metadataOnly: number;
    reviewRequired: number;
    done: number;
    failed: number;
    supportedWithSummary: number;
    taxBeleg: number;
  } {
    const total = (this.db.prepare('SELECT COUNT(*) AS c FROM registry_entries').get() as { c: number }).c;
    const metadataOnly = (
      this.db
        .prepare(`SELECT COUNT(*) AS c FROM registry_entries WHERE lifecycle_status = 'metadata_only'`)
        .get() as { c: number }
    ).c;
    const reviewRequired = (
      this.db
        .prepare(`SELECT COUNT(*) AS c FROM registry_entries WHERE lifecycle_status = 'review_required'`)
        .get() as { c: number }
    ).c;
    const done = (
      this.db.prepare(`SELECT COUNT(*) AS c FROM registry_entries WHERE lifecycle_status = 'done'`).get() as { c: number }
    ).c;
    const failed = (
      this.db.prepare(`SELECT COUNT(*) AS c FROM registry_entries WHERE lifecycle_status = 'failed'`).get() as { c: number }
    ).c;
    const supportedWithSummary = (
      this.db
        .prepare(
          `SELECT COUNT(*) AS c FROM registry_entries WHERE detected_type IN ('pdf','image') AND length(json_extract(classification_json, '$.summary')) > 10`
        )
        .get() as { c: number }
    ).c;
    const taxBeleg = (
      this.db.prepare(`SELECT COUNT(*) AS c FROM registry_entries WHERE naming_track = 'tax_beleg'`).get() as { c: number }
    ).c;

    return { total, metadataOnly, reviewRequired, done, failed, supportedWithSummary, taxBeleg };
  }

  public static parseClassification(json: string): RegistryClassification | null {
    try {
      return JSON.parse(json) as RegistryClassification;
    } catch {
      return null;
    }
  }

  private ensureSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS registry_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_path TEXT NOT NULL UNIQUE,
        source_file_name TEXT NOT NULL,
        file_hash TEXT NOT NULL,
        file_size_bytes INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        detected_type TEXT NOT NULL,
        lifecycle_status TEXT NOT NULL,
        classification_json TEXT NOT NULL,
        confidence REAL NOT NULL,
        warnings_json TEXT NOT NULL,
        doc_role TEXT NOT NULL,
        proposed_bucket TEXT NOT NULL,
        proposed_relative_path TEXT NOT NULL,
        naming_track TEXT NOT NULL,
        proposed_basename TEXT NOT NULL,
        display_title TEXT NOT NULL,
        naming_confidence REAL NOT NULL,
        approved TEXT NOT NULL DEFAULT 'pending',
        inventory_policy TEXT,
        error_message TEXT,
        processed_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_registry_confidence ON registry_entries(confidence);
      CREATE INDEX IF NOT EXISTS idx_registry_status ON registry_entries(lifecycle_status);
      CREATE INDEX IF NOT EXISTS idx_registry_approved ON registry_entries(approved);
      CREATE INDEX IF NOT EXISTS idx_registry_hash ON registry_entries(file_hash);
    `);
    this.migrateReviewColumns();
    this.ensureFilingRulesSchema();
  }

  private migrateReviewColumns(): void {
    const columns = this.db.prepare(`PRAGMA table_info(registry_entries)`).all() as Array<{ name: string }>;
    const names = new Set(columns.map((c) => c.name));
    if (!names.has('review_notes')) {
      this.db.exec(`ALTER TABLE registry_entries ADD COLUMN review_notes TEXT NOT NULL DEFAULT ''`);
    }
    if (!names.has('review_keep_filename')) {
      this.db.exec(`ALTER TABLE registry_entries ADD COLUMN review_keep_filename INTEGER NOT NULL DEFAULT 0`);
    }
    if (!names.has('review_basename_override')) {
      this.db.exec(`ALTER TABLE registry_entries ADD COLUMN review_basename_override TEXT NOT NULL DEFAULT ''`);
    }
    if (!names.has('review_relative_path_override')) {
      this.db.exec(`ALTER TABLE registry_entries ADD COLUMN review_relative_path_override TEXT NOT NULL DEFAULT ''`);
    }
    if (!names.has('review_decided_at')) {
      this.db.exec(`ALTER TABLE registry_entries ADD COLUMN review_decided_at TEXT`);
    }
  }

  private ensureFilingRulesSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS registry_filing_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rule_kind TEXT NOT NULL,
        match_value TEXT NOT NULL,
        keep_filename INTEGER NOT NULL DEFAULT 0,
        target_basename TEXT NOT NULL DEFAULT '',
        target_relative_path TEXT NOT NULL DEFAULT '',
        support_count INTEGER NOT NULL DEFAULT 1,
        example_source_path TEXT NOT NULL DEFAULT '',
        last_notes TEXT NOT NULL DEFAULT '',
        rule_status TEXT NOT NULL DEFAULT 'confirmed',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(rule_kind, match_value)
      );
      CREATE INDEX IF NOT EXISTS idx_filing_rules_match ON registry_filing_rules(rule_kind, match_value);
    `);
    const names = new Set(
      (
        this.db
          .prepare(`PRAGMA table_info(registry_filing_rules)`)
          .all() as Array<{ name: string }>
      ).map((column) => column.name)
    );
    if (!names.has('rule_status')) {
      this.db.exec(`ALTER TABLE registry_filing_rules ADD COLUMN rule_status TEXT NOT NULL DEFAULT 'confirmed'`);
    }
  }
}
