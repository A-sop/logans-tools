# Document Intake — Minimum Data Model (MVP)

Based on [concept-document-intake.md](./concept-document-intake.md). Scope: one-week slice only.

---

## 1. Entities

| Entity | Purpose |
|--------|---------|
| **Upload** | One document upload: file reference, extracted text, language |
| **Task suggestion** | 1–5 suggested tasks from the model per upload |

---

## 2. Fields (MVP)

### Upload
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | uuid | ✓ | Primary key |
| session_id | text | ✓ | Pre-auth scope; from httpOnly cookie |
| filename | text | ✓ | Original filename |
| storage_path | text | — | Path/URL where file is stored (future: cloud storage) |
| extracted_text | text | — | OCR/extracted content; can be long |
| language | text | — | Detected: `en` or `de` |
| created_at | timestamptz | ✓ | When uploaded |

### Task suggestion
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | uuid | ✓ | Primary key |
| upload_id | uuid | ✓ | FK → uploads.id |
| session_id | text | ✓ | Pre-auth scope |
| title | text | ✓ | Task title from model |
| due_date | date | — | Optional |
| note | text | — | Short note from model |
| created_at | timestamptz | ✓ | When created |

---

## 3. Relationships

```
Upload (1) ──────────< (0..5) Task suggestion
    │
    └── session_id scopes both to pre-auth user
```

- **Upload → Task suggestion:** 1:N (one upload has 1–5 task suggestions)
- **session_id:** Both tables share it; used to scope reads/writes for anonymous users (pre-login)

---

## 4. PostgreSQL Schema

```sql
-- Upload: one document per row
CREATE TABLE uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  filename text NOT NULL,
  storage_path text,
  extracted_text text,
  language text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Task suggestion: 1–5 per upload
CREATE TABLE task_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id uuid NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  title text NOT NULL,
  due_date date,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for session-scoped lookups
CREATE INDEX idx_uploads_session_id ON uploads(session_id);
CREATE INDEX idx_task_suggestions_session_id ON task_suggestions(session_id);
CREATE INDEX idx_task_suggestions_upload_id ON task_suggestions(upload_id);
```

---

## 5. Out of scope (MVP)

- Assignments, contacts, CRM linking
- Auth/users
- File storage (storage_path is placeholder; files may live in Vercel Blob / S3 / Dropbox later)
- Editing or completing tasks
- Notifications
