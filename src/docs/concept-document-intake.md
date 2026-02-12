# Document Intake → Saved Task Suggestions

## 1. Feature Name

Document Intake → Saved Task Suggestions

---

## 2. Problem & Outcome

**Problem:** Executives receive documents that imply follow-up actions, but turning them into clear tasks is manual and error-prone.

**Outcome:** A user uploads a document and gets a small set of suggested tasks that are saved so they can return later and see them.

---

## 3. Must-Have Scope (One-Week Slice)

### UI (Workspace)
- Upload one document (PDF or image).

### Processing (Server)
- Extract text (OCR if needed).
- Detect language (EN/DE).
- Send extracted text to an OpenAI model to generate 1–5 task suggestions (title + optional due date + short note) in the same language as the input.

### Persistence
Save: original file reference, extracted text, detected language, model output (task suggestions), `created_at`.

### UI (Workspace)
- Show a **Latest Upload** card with: filename, detected language, extracted text (read-only), and the saved task suggestions (read-only).

### Safety
- No outbound actions.
- No automatic updates to any other records.

---

## 4. Non-Goals / Future Extensions (Explicitly Out)

- No assignments/CRM linking (everything is "unassigned" for now).
- No approval flows or assistant role.
- No email/voice/WhatsApp intake (upload only).
- No document renaming/folder filing automation.
- No editing tasks, completing tasks, or notifications.
- No DIN letter generation or communications drafting/sending.
- No multi-language beyond EN/DE input-driven output.
- No auth/subscriptions (pre-login session persistence is enough).

---

## 5. Persistence (Required for This Lesson)

**Database:** Supabase (pre-login; proper auth later).

- **Server-only DB access** — Call Supabase from Server Actions/API routes using a **service role key** in `.env.local` (never from the client).
- **Session identifier:** Generate a random `session_id` (uuid) and store it in an `httpOnly` cookie. Use it on the server to read/write that session’s rows. Don’t expose the key publicly.
- **No public client yet** — Avoid client-side Supabase calls pre-auth; keep all access on the server to prevent data leaks.

**Docs:** [Supabase Next.js Quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs) · Auth overview (for later) · Security basics

### Tables (Minimum)

```
uploads(
  id uuid PRIMARY KEY,
  session_id uuid,
  filename text,
  storage_path text,
  extracted_text text,
  language text,
  created_at timestamptz
)

task_suggestions(
  id uuid PRIMARY KEY,
  upload_id uuid REFERENCES uploads(id),
  session_id uuid,
  title text,
  due_date date,
  note text,
  created_at timestamptz
)
```
