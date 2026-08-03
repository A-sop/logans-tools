import Database from 'better-sqlite3';
import type {
  AcceptedClassification,
  AcceptedOutcomeRecord,
  CandidateRuleRecord,
  LearningRuleType,
  ProcessedDocumentRecord,
} from '@/lib/atlas-ops/document-intake/types';

type DocumentRow = {
  id: number;
};

type DocumentLookupRow = {
  id: number;
  file_hash: string;
  processed_file_name: string;
  lifecycle_status: string;
  classification_json: string;
  confidence: number;
};

type CandidateRuleRow = {
  id: number;
  rule_type: LearningRuleType;
  source_value: string;
  target_value: string;
  support_count: number;
  precision_score: number;
  status: 'candidate' | 'promoted' | 'rejected';
};

type PromotedRuleRow = {
  rule_type: LearningRuleType;
  source_value: string;
  target_value: string;
  version: number;
};

export class SqliteDocumentIndex {
  private readonly db: Database.Database;

  public constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.ensureSchema();
  }

  public close(): void {
    this.db.close();
  }

  public hasHash(fileHash: string): boolean {
    const statement = this.db.prepare('SELECT id FROM documents WHERE file_hash = ? LIMIT 1');
    const row = statement.get(fileHash) as DocumentRow | undefined;
    return Boolean(row?.id);
  }

  public upsertDocument(record: ProcessedDocumentRecord): void {
    const statement = this.db.prepare(`
      INSERT INTO documents (
        source_file_name,
        source_path,
        processed_file_name,
        processed_path,
        markdown_path,
        file_hash,
        mime_type,
        detected_type,
        lifecycle_status,
        classification_json,
        confidence,
        warnings_json,
        error_message,
        processed_at,
        created_at
      )
      VALUES (
        @sourceFileName,
        @sourcePath,
        @processedFileName,
        @processedPath,
        @markdownPath,
        @fileHash,
        @mimeType,
        @detectedType,
        @lifecycleStatus,
        @classificationJson,
        @confidence,
        @warningsJson,
        @errorMessage,
        @processedAtIso,
        datetime('now')
      )
      ON CONFLICT(file_hash) DO UPDATE SET
        source_file_name=excluded.source_file_name,
        source_path=excluded.source_path,
        processed_file_name=excluded.processed_file_name,
        processed_path=excluded.processed_path,
        markdown_path=excluded.markdown_path,
        mime_type=excluded.mime_type,
        detected_type=excluded.detected_type,
        lifecycle_status=excluded.lifecycle_status,
        classification_json=excluded.classification_json,
        confidence=excluded.confidence,
        warnings_json=excluded.warnings_json,
        error_message=excluded.error_message,
        processed_at=excluded.processed_at
    `);

    statement.run(record);
  }

  public getDocumentByProcessedFileName(processedFileName: string): DocumentLookupRow | null {
    const statement = this.db.prepare(`
      SELECT id, file_hash, processed_file_name, lifecycle_status, classification_json, confidence
      FROM documents
      WHERE processed_file_name = ?
      ORDER BY id DESC
      LIMIT 1
    `);
    const row = statement.get(processedFileName) as DocumentLookupRow | undefined;
    return row ?? null;
  }

  public getDocumentByFileHash(fileHash: string): DocumentLookupRow | null {
    const statement = this.db.prepare(`
      SELECT id, file_hash, processed_file_name, lifecycle_status, classification_json, confidence
      FROM documents
      WHERE file_hash = ?
      LIMIT 1
    `);
    const row = statement.get(fileHash) as DocumentLookupRow | undefined;
    return row ?? null;
  }

  public upsertAcceptedOutcome(record: AcceptedOutcomeRecord): void {
    const statement = this.db.prepare(`
      INSERT INTO accepted_outcomes (
        document_id,
        file_hash,
        acceptance_source,
        accepted_at,
        model_version,
        rule_version,
        predicted_json,
        accepted_json,
        delta_json
      )
      VALUES (
        @documentId,
        @fileHash,
        @acceptanceSource,
        @acceptedAtIso,
        @modelVersion,
        @ruleVersion,
        @predictedJson,
        @acceptedJson,
        @deltaJson
      )
      ON CONFLICT(document_id) DO UPDATE SET
        file_hash=excluded.file_hash,
        acceptance_source=excluded.acceptance_source,
        accepted_at=excluded.accepted_at,
        model_version=excluded.model_version,
        rule_version=excluded.rule_version,
        predicted_json=excluded.predicted_json,
        accepted_json=excluded.accepted_json,
        delta_json=excluded.delta_json
    `);
    statement.run(record);
  }

  public listAcceptedOutcomeRows(): Array<{
    id: number;
    document_id: number;
    file_hash: string;
    predicted_json: string;
    accepted_json: string;
    delta_json: string;
    accepted_at: string;
    acceptance_source: string;
    model_version: string;
    rule_version: number;
  }> {
    const statement = this.db.prepare(`
      SELECT
        id,
        document_id,
        file_hash,
        predicted_json,
        accepted_json,
        delta_json,
        accepted_at,
        acceptance_source,
        model_version,
        rule_version
      FROM accepted_outcomes
      ORDER BY accepted_at DESC
    `);
    return statement.all() as Array<{
      id: number;
      document_id: number;
      file_hash: string;
      predicted_json: string;
      accepted_json: string;
      delta_json: string;
      accepted_at: string;
      acceptance_source: string;
      model_version: string;
      rule_version: number;
    }>;
  }

  public upsertCandidateRule(record: CandidateRuleRecord): void {
    const statement = this.db.prepare(`
      INSERT INTO candidate_rules (
        rule_type,
        source_value,
        target_value,
        support_count,
        precision_score,
        status,
        first_seen_at,
        last_seen_at,
        created_at,
        updated_at
      )
      VALUES (
        @ruleType,
        @sourceValue,
        @targetValue,
        @supportCount,
        @precisionScore,
        @status,
        @firstSeenAtIso,
        @lastSeenAtIso,
        datetime('now'),
        datetime('now')
      )
      ON CONFLICT(rule_type, source_value, target_value) DO UPDATE SET
        support_count=excluded.support_count,
        precision_score=excluded.precision_score,
        status=excluded.status,
        first_seen_at=excluded.first_seen_at,
        last_seen_at=excluded.last_seen_at,
        updated_at=datetime('now')
    `);
    statement.run(record);
  }

  public listCandidateRules(status: 'candidate' | 'promoted' | 'rejected' | 'all' = 'all'): CandidateRuleRow[] {
    if (status === 'all') {
      const statement = this.db.prepare(`
        SELECT id, rule_type, source_value, target_value, support_count, precision_score, status
        FROM candidate_rules
        ORDER BY support_count DESC, precision_score DESC, id ASC
      `);
      return statement.all() as CandidateRuleRow[];
    }

    const statement = this.db.prepare(`
      SELECT id, rule_type, source_value, target_value, support_count, precision_score, status
      FROM candidate_rules
      WHERE status = ?
      ORDER BY support_count DESC, precision_score DESC, id ASC
    `);
    return statement.all(status) as CandidateRuleRow[];
  }

  public beginPromotionRun(candidateCount: number): number {
    const statement = this.db.prepare(`
      INSERT INTO promotion_runs (
        run_started_at,
        candidate_count,
        promoted_count,
        metrics_json,
        status
      )
      VALUES (datetime('now'), ?, 0, '{}', 'running')
    `);
    const result = statement.run(candidateCount);
    return Number(result.lastInsertRowid);
  }

  public finishPromotionRun(
    runId: number,
    promotedCount: number,
    status: 'succeeded' | 'failed',
    metricsJson: string,
    errorMessage: string | null
  ): void {
    const statement = this.db.prepare(`
      UPDATE promotion_runs
      SET promoted_count = ?,
          status = ?,
          metrics_json = ?,
          error_message = ?,
          run_finished_at = datetime('now')
      WHERE id = ?
    `);
    statement.run(promotedCount, status, metricsJson, errorMessage, runId);
  }

  public getCurrentRuleVersion(): number {
    const statement = this.db.prepare(`
      SELECT MAX(version) AS max_version
      FROM promoted_rules
    `);
    const row = statement.get() as { max_version: number | null };
    return row.max_version ?? 0;
  }

  public getPreviousRuleVersion(currentVersion: number): number | null {
    const statement = this.db.prepare(`
      SELECT MAX(version) AS prev_version
      FROM promoted_rules
      WHERE version < ?
    `);
    const row = statement.get(currentVersion) as { prev_version: number | null };
    return row.prev_version ?? null;
  }

  public promoteCandidateRules(candidateIds: number[], version: number): void {
    const selectStatement = this.db.prepare(`
      SELECT id, rule_type, source_value, target_value
      FROM candidate_rules
      WHERE id = ?
    `);
    const insertStatement = this.db.prepare(`
      INSERT INTO promoted_rules (
        candidate_rule_id,
        rule_type,
        source_value,
        target_value,
        version,
        is_active,
        promoted_at,
        metrics_json
      )
      VALUES (?, ?, ?, ?, ?, 1, datetime('now'), '{}')
    `);
    const markCandidateStatement = this.db.prepare(`
      UPDATE candidate_rules
      SET status = 'promoted',
          updated_at = datetime('now'),
          last_evaluated_at = datetime('now')
      WHERE id = ?
    `);
    const deactivateCurrentActiveStatement = this.db.prepare(`
      UPDATE promoted_rules
      SET is_active = 0, demoted_at = datetime('now')
      WHERE rule_type = ? AND source_value = ? AND is_active = 1
    `);

    const transaction = this.db.transaction((ids: number[]) => {
      for (const id of ids) {
        const row = selectStatement.get(id) as {
          id: number;
          rule_type: LearningRuleType;
          source_value: string;
          target_value: string;
        } | null;
        if (!row) continue;
        deactivateCurrentActiveStatement.run(row.rule_type, row.source_value);
        insertStatement.run(row.id, row.rule_type, row.source_value, row.target_value, version);
        markCandidateStatement.run(row.id);
      }
    });
    transaction(candidateIds);
  }

  public markCandidateRulesRejected(candidateIds: number[]): void {
    const statement = this.db.prepare(`
      UPDATE candidate_rules
      SET status = 'rejected',
          updated_at = datetime('now'),
          last_evaluated_at = datetime('now')
      WHERE id = ?
    `);
    const transaction = this.db.transaction((ids: number[]) => {
      for (const id of ids) statement.run(id);
    });
    transaction(candidateIds);
  }

  public getActivePromotedRules(versionOverride: number | null = null): PromotedRuleRow[] {
    if (versionOverride && versionOverride > 0) {
      const statement = this.db.prepare(`
        SELECT rule_type, source_value, target_value, version
        FROM promoted_rules
        WHERE version = ?
        ORDER BY id ASC
      `);
      return statement.all(versionOverride) as PromotedRuleRow[];
    }

    const statement = this.db.prepare(`
      SELECT rule_type, source_value, target_value, version
      FROM promoted_rules
      WHERE is_active = 1
      ORDER BY id ASC
    `);
    return statement.all() as PromotedRuleRow[];
  }

  public activateRuleVersion(version: number): void {
    const transaction = this.db.transaction((targetVersion: number) => {
      this.db
        .prepare(
          `
        UPDATE promoted_rules
        SET is_active = 0, demoted_at = datetime('now')
        WHERE is_active = 1
      `
        )
        .run();
      this.db
        .prepare(
          `
        UPDATE promoted_rules
        SET is_active = 1, demoted_at = NULL
        WHERE version = ?
      `
        )
        .run(targetVersion);
    });
    transaction(version);
  }

  public getKpiMetrics(): {
    acceptedCount: number;
    orgMatchRate: number;
    personMatchRate: number;
    dateMatchRate: number;
    actionMatchRate: number;
    statusMatchRate: number;
    reviewRequiredRate: number;
    renameCorrectionRate: number;
  } {
    const acceptedRows = this.listAcceptedOutcomeRows();
    const acceptedCount = acceptedRows.length;
    if (acceptedCount === 0) {
      return {
        acceptedCount: 0,
        orgMatchRate: 0,
        personMatchRate: 0,
        dateMatchRate: 0,
        actionMatchRate: 0,
        statusMatchRate: 0,
        reviewRequiredRate: 0,
        renameCorrectionRate: 0,
      };
    }

    let orgMatches = 0;
    let personMatches = 0;
    let dateMatches = 0;
    let actionMatches = 0;
    let statusMatches = 0;
    let renameCorrections = 0;

    for (const row of acceptedRows) {
      const predicted = this.parseAcceptedClassification(row.predicted_json);
      const accepted = this.parseAcceptedClassification(row.accepted_json);
      if (!predicted || !accepted) continue;

      if (predicted.organization === accepted.organization) orgMatches += 1;
      if (predicted.person === accepted.person) personMatches += 1;
      if (predicted.documentDateYYMMDD === accepted.documentDateYYMMDD) dateMatches += 1;
      if (predicted.action === accepted.action) actionMatches += 1;
      if (predicted.status === accepted.status) statusMatches += 1;
      if (predicted.organization !== accepted.organization || predicted.person !== accepted.person) {
        renameCorrections += 1;
      }
    }

    const reviewRow = this.db
      .prepare(`SELECT COUNT(*) AS c FROM documents WHERE lifecycle_status = 'review_required'`)
      .get() as { c: number };
    const totalRow = this.db.prepare(`SELECT COUNT(*) AS c FROM documents`).get() as { c: number };
    const reviewRequiredRate = totalRow.c > 0 ? reviewRow.c / totalRow.c : 0;

    return {
      acceptedCount,
      orgMatchRate: orgMatches / acceptedCount,
      personMatchRate: personMatches / acceptedCount,
      dateMatchRate: dateMatches / acceptedCount,
      actionMatchRate: actionMatches / acceptedCount,
      statusMatchRate: statusMatches / acceptedCount,
      reviewRequiredRate,
      renameCorrectionRate: renameCorrections / acceptedCount,
    };
  }

  private ensureSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_file_name TEXT NOT NULL,
        source_path TEXT NOT NULL,
        processed_file_name TEXT NOT NULL,
        processed_path TEXT NOT NULL,
        markdown_path TEXT NOT NULL,
        file_hash TEXT NOT NULL UNIQUE,
        mime_type TEXT NOT NULL,
        detected_type TEXT NOT NULL,
        lifecycle_status TEXT NOT NULL,
        classification_json TEXT NOT NULL,
        confidence REAL NOT NULL,
        warnings_json TEXT NOT NULL,
        error_message TEXT,
        processed_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_documents_processed_at ON documents(processed_at);
      CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(lifecycle_status);
      CREATE INDEX IF NOT EXISTS idx_documents_org ON documents(classification_json);

      CREATE TABLE IF NOT EXISTS accepted_outcomes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER NOT NULL UNIQUE,
        file_hash TEXT NOT NULL,
        acceptance_source TEXT NOT NULL,
        accepted_at TEXT NOT NULL,
        model_version TEXT NOT NULL,
        rule_version INTEGER NOT NULL,
        predicted_json TEXT NOT NULL,
        accepted_json TEXT NOT NULL,
        delta_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_accepted_outcomes_accepted_at ON accepted_outcomes(accepted_at);
      CREATE INDEX IF NOT EXISTS idx_accepted_outcomes_file_hash ON accepted_outcomes(file_hash);

      CREATE TABLE IF NOT EXISTS candidate_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rule_type TEXT NOT NULL,
        source_value TEXT NOT NULL,
        target_value TEXT NOT NULL,
        support_count INTEGER NOT NULL,
        precision_score REAL NOT NULL,
        status TEXT NOT NULL,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        last_evaluated_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(rule_type, source_value, target_value)
      );
      CREATE INDEX IF NOT EXISTS idx_candidate_rules_status ON candidate_rules(status);
      CREATE INDEX IF NOT EXISTS idx_candidate_rules_support ON candidate_rules(support_count, precision_score);

      CREATE TABLE IF NOT EXISTS promoted_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        candidate_rule_id INTEGER,
        rule_type TEXT NOT NULL,
        source_value TEXT NOT NULL,
        target_value TEXT NOT NULL,
        version INTEGER NOT NULL,
        is_active INTEGER NOT NULL,
        promoted_at TEXT NOT NULL,
        demoted_at TEXT,
        metrics_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_promoted_rules_active ON promoted_rules(is_active);
      CREATE INDEX IF NOT EXISTS idx_promoted_rules_version ON promoted_rules(version);

      CREATE TABLE IF NOT EXISTS promotion_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_started_at TEXT NOT NULL,
        run_finished_at TEXT,
        candidate_count INTEGER NOT NULL,
        promoted_count INTEGER NOT NULL,
        metrics_json TEXT NOT NULL,
        status TEXT NOT NULL,
        error_message TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_promotion_runs_started ON promotion_runs(run_started_at);
    `);
  }

  private parseAcceptedClassification(payload: string): AcceptedClassification | null {
    try {
      const parsed = JSON.parse(payload) as Partial<AcceptedClassification>;
      if (
        typeof parsed.documentDateYYMMDD !== 'string' ||
        typeof parsed.organization !== 'string' ||
        typeof parsed.action !== 'string' ||
        typeof parsed.person !== 'string' ||
        typeof parsed.status !== 'string'
      ) {
        return null;
      }
      return {
        documentDateYYMMDD: parsed.documentDateYYMMDD,
        organization: parsed.organization,
        action: parsed.action,
        person: parsed.person,
        status: parsed.status,
      };
    } catch {
      return null;
    }
  }
}
