export interface LocalCrmPaths {
  root: string;
  dbPath: string;
  exportsDir: string;
}

export interface ContactRecord {
  id: number;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  sourceSystem: string | null;
  externalRef: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertContactInput {
  fullName: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  sourceSystem?: string | null;
  externalRef?: string | null;
  notes?: string | null;
}

export interface UpsertContactOptions {
  /** When false, only match on source_system + external_ref (DVAG Kundennummer). Default true. */
  matchEmail?: boolean;
}

export interface InteractionInput {
  contactId: number;
  happenedAtIso?: string;
  channel?: string | null;
  summary: string;
  details?: string | null;
}

export interface TaskInput {
  contactId: number;
  title: string;
  dueDateIso?: string | null;
  status?: 'open' | 'done' | 'canceled';
  priority?: 'low' | 'normal' | 'high';
  notes?: string | null;
}
