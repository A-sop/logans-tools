import Database from 'better-sqlite3';
import type {
  ContactRecord,
  InteractionInput,
  TaskInput,
  UpsertContactInput,
  UpsertContactOptions,
} from '@/lib/atlas-ops/contact-network/local-crm-types';

type ContactRow = {
  id: number;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  source_system: string | null;
  external_ref: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export class LocalCrmIndex {
  private readonly db: Database.Database;

  public constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.ensureSchema();
  }

  public close(): void {
    this.db.close();
  }

  public seedDefaultTags(): void {
    const defaults = [
      { key: 'private', label: 'Private' },
      { key: 'business', label: 'Business' },
      { key: 'friend', label: 'Friend' },
      { key: 'customer', label: 'Customer' },
      { key: 'partner', label: 'Partner' },
      { key: 'referral', label: 'Referral' },
      { key: 'gfp', label: 'German Financial Planning' },
      { key: 'dvag', label: 'DVAG' },
    ];

    const statement = this.db.prepare(`
      INSERT INTO tags (key, label, created_at)
      VALUES (@key, @label, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET
        label = excluded.label
    `);
    const tx = this.db.transaction((rows: typeof defaults) => {
      for (const row of rows) statement.run(row);
    });
    tx(defaults);
  }

  public upsertContact(input: UpsertContactInput, options: UpsertContactOptions = {}): number {
    const matchEmail = options.matchEmail !== false;
    if (!input.fullName || input.fullName.trim().length === 0) {
      throw new Error('fullName is required');
    }

    const trimmedEmail = input.email?.trim().toLowerCase() ?? null;
    const normalizedExternalRef = input.externalRef?.trim() ?? null;
    const normalizedSourceSystem = input.sourceSystem?.trim() ?? null;
    const now = new Date().toISOString();

    if (normalizedSourceSystem && normalizedExternalRef) {
      const byExternal = this.db
        .prepare(
          `
          SELECT id
          FROM contacts
          WHERE source_system = ? AND external_ref = ?
          LIMIT 1
        `
        )
        .get(normalizedSourceSystem, normalizedExternalRef) as { id: number } | undefined;
      if (byExternal?.id) {
        this.updateContact(byExternal.id, input, now);
        return byExternal.id;
      }
    }

    if (matchEmail && trimmedEmail) {
      const byEmail = this.db
        .prepare(
          `
          SELECT id
          FROM contacts
          WHERE email = ?
          LIMIT 1
        `
        )
        .get(trimmedEmail) as { id: number } | undefined;
      if (byEmail?.id) {
        this.updateContact(byEmail.id, input, now);
        return byEmail.id;
      }
    }

    const insert = this.db.prepare(`
      INSERT INTO contacts (
        full_name,
        first_name,
        last_name,
        email,
        phone,
        company,
        source_system,
        external_ref,
        notes,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = insert.run(
      input.fullName.trim(),
      input.firstName?.trim() || null,
      input.lastName?.trim() || null,
      trimmedEmail,
      input.phone?.trim() || null,
      input.company?.trim() || null,
      normalizedSourceSystem,
      normalizedExternalRef,
      input.notes?.trim() || null,
      now,
      now
    );
    return Number(result.lastInsertRowid);
  }

  public setContactTags(contactId: number, tagKeys: string[]): void {
    const uniqueKeys = Array.from(new Set(tagKeys.map((v) => v.trim().toLowerCase()).filter(Boolean)));
    const tagSelect = this.db.prepare(`SELECT id FROM tags WHERE key = ? LIMIT 1`);
    const tagInsert = this.db.prepare(`
      INSERT INTO tags (key, label, created_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO NOTHING
    `);
    const clear = this.db.prepare(`DELETE FROM contact_tags WHERE contact_id = ?`);
    const link = this.db.prepare(`
      INSERT INTO contact_tags (contact_id, tag_id, created_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(contact_id, tag_id) DO NOTHING
    `);

    const tx = this.db.transaction((id: number, keys: string[]) => {
      clear.run(id);
      for (const key of keys) {
        const defaultLabel = key
          .split('_')
          .map((part) => (part.length > 0 ? part[0].toUpperCase() + part.slice(1) : part))
          .join(' ');
        tagInsert.run(key, defaultLabel);
        const tag = tagSelect.get(key) as { id: number } | undefined;
        if (tag?.id) link.run(id, tag.id);
      }
    });

    tx(contactId, uniqueKeys);
  }

  /** Add tags without removing existing ones. */
  public addContactTags(contactId: number, tagKeys: string[]): void {
    const uniqueKeys = Array.from(new Set(tagKeys.map((v) => v.trim().toLowerCase()).filter(Boolean)));
    const tagSelect = this.db.prepare(`SELECT id FROM tags WHERE key = ? LIMIT 1`);
    const tagInsert = this.db.prepare(`
      INSERT INTO tags (key, label, created_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO NOTHING
    `);
    const link = this.db.prepare(`
      INSERT INTO contact_tags (contact_id, tag_id, created_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(contact_id, tag_id) DO NOTHING
    `);

    const tx = this.db.transaction((id: number, keys: string[]) => {
      for (const key of keys) {
        tagInsert.run(key, key);
        const tag = tagSelect.get(key) as { id: number } | undefined;
        if (tag?.id) link.run(id, tag.id);
      }
    });
    tx(contactId, uniqueKeys);
  }

  public appendContactNotes(contactId: number, fragment: string): void {
    const trimmed = fragment.trim();
    if (!trimmed) return;
    const row = this.db
      .prepare(`SELECT notes FROM contacts WHERE id = ?`)
      .get(contactId) as { notes: string | null } | undefined;
    if (!row) return;
    const existing = row.notes?.trim() ?? '';
    if (existing.includes(trimmed)) return;
    const notes = existing ? `${existing} · ${trimmed}` : trimmed;
    this.db
      .prepare(`UPDATE contacts SET notes = ?, updated_at = ? WHERE id = ?`)
      .run(notes, new Date().toISOString(), contactId);
  }

  public findContactIdByEmail(email: string): number | null {
    const normalized = email.trim().toLowerCase();
    const row = this.db
      .prepare(`SELECT id FROM contacts WHERE email = ? LIMIT 1`)
      .get(normalized) as { id: number } | undefined;
    return row?.id ?? null;
  }

  public findContactIdByPhone(phone: string): number | null {
    const digits = phone.replace(/\D/g, '').slice(-11);
    if (digits.length < 8) return null;
    const row = this.db
      .prepare(`SELECT id, phone FROM contacts WHERE phone IS NOT NULL`)
      .all() as Array<{ id: number; phone: string }>;
    for (const r of row) {
      if (r.phone.replace(/\D/g, '').slice(-11) === digits) return r.id;
    }
    return null;
  }

  public clearContactNetwork(): void {
    this.db.exec(`
      DELETE FROM contact_tags;
      DELETE FROM interactions;
      DELETE FROM tasks;
      DELETE FROM contacts;
    `);
  }

  public countContacts(): number {
    const row = this.db.prepare(`SELECT COUNT(*) AS c FROM contacts`).get() as { c: number };
    return row.c;
  }

  public addInteraction(input: InteractionInput): number {
    const statement = this.db.prepare(`
      INSERT INTO interactions (contact_id, happened_at, channel, summary, details, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `);
    const result = statement.run(
      input.contactId,
      input.happenedAtIso ?? new Date().toISOString(),
      input.channel?.trim() || null,
      input.summary.trim(),
      input.details?.trim() || null
    );
    return Number(result.lastInsertRowid);
  }

  public addTask(input: TaskInput): number {
    const statement = this.db.prepare(`
      INSERT INTO tasks (contact_id, title, due_date, status, priority, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
    const result = statement.run(
      input.contactId,
      input.title.trim(),
      input.dueDateIso ?? null,
      input.status ?? 'open',
      input.priority ?? 'normal',
      input.notes?.trim() || null
    );
    return Number(result.lastInsertRowid);
  }

  /** Idempotent open-task seed: same contact + title while open → reuse row (updates notes/due/priority). */
  public ensureOpenTask(input: TaskInput): { id: number; created: boolean } {
    const title = input.title.trim();
    const existing = this.db
      .prepare(
        `
        SELECT id FROM tasks
        WHERE contact_id = ? AND status = 'open' AND lower(title) = lower(?)
        LIMIT 1
      `
      )
      .get(input.contactId, title) as { id: number } | undefined;

    if (existing) {
      this.db
        .prepare(
          `
          UPDATE tasks
          SET due_date = COALESCE(?, due_date),
              priority = COALESCE(?, priority),
              notes = COALESCE(?, notes),
              updated_at = datetime('now')
          WHERE id = ?
        `
        )
        .run(input.dueDateIso ?? null, input.priority ?? null, input.notes?.trim() || null, existing.id);
      return { id: existing.id, created: false };
    }

    return { id: this.addTask({ ...input, title, status: 'open' }), created: true };
  }

  public completeTask(taskId: number, status: 'done' | 'canceled' = 'done'): boolean {
    const result = this.db
      .prepare(
        `
        UPDATE tasks
        SET status = ?, updated_at = datetime('now')
        WHERE id = ? AND status = 'open'
      `
      )
      .run(status, taskId);
    return result.changes > 0;
  }

  public getContactByName(search: string): ContactRecord[] {
    const normalized = `%${search.trim().toLowerCase()}%`;
    const statement = this.db.prepare(`
      SELECT id, full_name, first_name, last_name, email, phone, company, source_system, external_ref, notes, created_at, updated_at
      FROM contacts
      WHERE lower(full_name) LIKE ?
      ORDER BY full_name ASC
      LIMIT 25
    `);
    const rows = statement.all(normalized) as ContactRow[];
    return rows.map(mapContactRow);
  }

  public listContactsByTags(tagKeys: string[]): Array<ContactRecord & { tags: string[] }> {
    if (tagKeys.length === 0) {
      return this.listContactsWithTags();
    }

    const normalized = Array.from(new Set(tagKeys.map((key) => key.trim().toLowerCase()).filter(Boolean)));
    const placeholders = normalized.map(() => '?').join(', ');
    const statement = this.db.prepare(`
      SELECT c.id, c.full_name, c.first_name, c.last_name, c.email, c.phone, c.company, c.source_system, c.external_ref, c.notes, c.created_at, c.updated_at
      FROM contacts c
      JOIN contact_tags ct ON ct.contact_id = c.id
      JOIN tags t ON t.id = ct.tag_id
      WHERE t.key IN (${placeholders})
      GROUP BY c.id
      HAVING COUNT(DISTINCT t.key) = ?
      ORDER BY c.full_name ASC
    `);
    const rows = statement.all(...normalized, normalized.length) as ContactRow[];

    return rows.map((row) => ({
      ...mapContactRow(row),
      tags: this.listTagKeysForContact(row.id),
    }));
  }

  public listOpenTasks(dueBeforeIso?: string): Array<{
    id: number;
    contactId: number;
    contactName: string;
    title: string;
    dueDate: string | null;
    priority: string;
    status: string;
  }> {
    const condition = dueBeforeIso ? 'AND (t.due_date IS NULL OR t.due_date <= ?)' : '';
    const statement = this.db.prepare(`
      SELECT
        t.id AS id,
        c.id AS contact_id,
        c.full_name AS contact_name,
        t.title AS title,
        t.due_date AS due_date,
        t.priority AS priority,
        t.status AS status
      FROM tasks t
      JOIN contacts c ON c.id = t.contact_id
      WHERE t.status = 'open'
      ${condition}
      ORDER BY t.due_date IS NULL, t.due_date ASC, c.full_name ASC
    `);
    const rows = (dueBeforeIso ? statement.all(dueBeforeIso) : statement.all()) as Array<{
      id: number;
      contact_id: number;
      contact_name: string;
      title: string;
      due_date: string | null;
      priority: string;
      status: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      contactId: row.contact_id,
      contactName: row.contact_name,
      title: row.title,
      dueDate: row.due_date,
      priority: row.priority,
      status: row.status,
    }));
  }

  public exportContactsByTags(tagKeys: string[]): {
    exportedAt: string;
    filters: string[];
    contacts: Array<ContactRecord & { tags: string[] }>;
  } {
    const contacts = this.listContactsByTags(tagKeys);
    return {
      exportedAt: new Date().toISOString(),
      filters: tagKeys,
      contacts,
    };
  }

  private listContactsWithTags(): Array<ContactRecord & { tags: string[] }> {
    const statement = this.db.prepare(`
      SELECT id, full_name, first_name, last_name, email, phone, company, source_system, external_ref, notes, created_at, updated_at
      FROM contacts
      ORDER BY full_name ASC
    `);
    const rows = statement.all() as ContactRow[];
    return rows.map((row) => ({
      ...mapContactRow(row),
      tags: this.listTagKeysForContact(row.id),
    }));
  }

  private listTagKeysForContact(contactId: number): string[] {
    const statement = this.db.prepare(`
      SELECT t.key
      FROM contact_tags ct
      JOIN tags t ON t.id = ct.tag_id
      WHERE ct.contact_id = ?
      ORDER BY t.key ASC
    `);
    const rows = statement.all(contactId) as Array<{ key: string }>;
    return rows.map((row) => row.key);
  }

  private updateContact(contactId: number, input: UpsertContactInput, nowIso: string): void {
    const statement = this.db.prepare(`
      UPDATE contacts
      SET
        full_name = ?,
        first_name = ?,
        last_name = ?,
        email = ?,
        phone = ?,
        company = ?,
        source_system = ?,
        external_ref = ?,
        notes = ?,
        updated_at = ?
      WHERE id = ?
    `);

    statement.run(
      input.fullName.trim(),
      input.firstName?.trim() || null,
      input.lastName?.trim() || null,
      input.email?.trim().toLowerCase() || null,
      input.phone?.trim() || null,
      input.company?.trim() || null,
      input.sourceSystem?.trim() || null,
      input.externalRef?.trim() || null,
      input.notes?.trim() || null,
      nowIso,
      contactId
    );
  }

  private ensureSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        email TEXT,
        phone TEXT,
        company TEXT,
        source_system TEXT,
        external_ref TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_source_external
      ON contacts(source_system, external_ref)
      WHERE source_system IS NOT NULL AND external_ref IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_contacts_full_name ON contacts(full_name);
      CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);

      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        label TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS contact_tags (
        contact_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY(contact_id, tag_id),
        FOREIGN KEY(contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
        FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS interactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contact_id INTEGER NOT NULL,
        happened_at TEXT NOT NULL,
        channel TEXT,
        summary TEXT NOT NULL,
        details TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(contact_id) REFERENCES contacts(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_interactions_contact_date
      ON interactions(contact_id, happened_at DESC);

      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contact_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        due_date TEXT,
        status TEXT NOT NULL CHECK(status IN ('open', 'done', 'canceled')),
        priority TEXT NOT NULL CHECK(priority IN ('low', 'normal', 'high')),
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(contact_id) REFERENCES contacts(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_status_due_date
      ON tasks(status, due_date);
    `);
  }
}

function mapContactRow(row: ContactRow): ContactRecord {
  return {
    id: row.id,
    fullName: row.full_name,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    company: row.company,
    sourceSystem: row.source_system,
    externalRef: row.external_ref,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
