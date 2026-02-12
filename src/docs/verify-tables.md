# Verify Document Intake Tables

Checklist for [Supabase Dashboard](https://supabase.com/dashboard) → your project.

---

## 1. Table Editor

- [ ] `uploads` table exists with columns: id, session_id, filename, storage_path, extracted_text, language, created_at
- [ ] `task_suggestions` table exists with columns: id, upload_id, session_id, title, due_date, note, created_at

---

## 2. Insert sample data

Run `src/docs/sample-data-document-intake.sql` in **SQL Editor**. This inserts:
- 2 uploads (invoice.pdf, contract.pdf)
- 2 task suggestions for invoice.pdf (Review invoice, Send to accounting)

---

## 3. Verify constraints

Our MVP has **NOT NULL** and **FK** constraints. Run these in SQL Editor:

**Should succeed (valid insert):**
```sql
insert into public.uploads (session_id, filename) values ('test-001', 'test.pdf');
```

**Should fail (NOT NULL violation):**
```sql
insert into public.uploads (session_id, filename) values (null, 'test.pdf');
-- ERROR: null value in column "session_id" violates not-null constraint
```

**Should fail (invalid FK):**
```sql
insert into public.task_suggestions (upload_id, session_id, title) 
values ('00000000-0000-0000-0000-000000000000'::uuid, 'x', 'Fake');
-- ERROR: insert or update on table "task_suggestions" violates foreign key constraint
```

---

## 4. Source of truth

Schema files: `supabase/schemas/01_uploads.sql`, `02_task_suggestions.sql`

To change the schema: edit these files, then create a new migration (manual, since db diff needs Docker) and push.
