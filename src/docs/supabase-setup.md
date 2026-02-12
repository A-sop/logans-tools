# Supabase Setup Guide

Step-by-step guide for creating and configuring a Supabase project for this app. Based on [concept.md](./concept.md) and [concept-document-intake.md](./concept-document-intake.md).

---

## Checkpoint: Already Set Up?

If you've already created a Supabase project and the **Test Supabase** button works in Workspace → Developer Tools, you're done. Skip to [Key formats & security](#5-key-formats-and-security) for reference.

---

## 1. Create a Supabase Account

1. Go to [supabase.com](https://supabase.com)
2. Click **Start your project** (or **Sign in**)
3. Sign up with GitHub, Google, or email

---

## 2. Create a New Project

1. In the dashboard, click **New project**
2. **Organization:** Use default or create one
3. **Project settings:**

   | Setting | Recommendation |
   |---------|----------------|
   | **Name** | `my-app` or `my-app-document-intake` |
   | **Database password** | Generate a strong password. **Save it immediately** in a password manager — you'll need it for direct DB access. You won't need it for the Next.js app (we use API keys). |
   | **Region** | Choose closest to your target users. For EU (e.g. Germany): `Frankfurt (eu-central-1)` or `Ireland (eu-west-1)`. For US: `N. Virginia` or `Oregon`. |

4. Click **Create new project** (takes ~2 minutes)

---

## 3. Find Your API Keys

1. In the project dashboard, go to **Project Settings** (gear icon) → **API**
2. Or use the **Connect** button (top right) for a quick overview

You'll see:

| Key | Format | Where |
|-----|--------|-------|
| **Project URL** | `https://xxxxx.supabase.co` | Top of API page |
| **Publishable key** | `sb_publishable_...` (or legacy `anon`) | API Keys section |
| **Secret key** | `sb_secret_...` (or legacy `service_role`) | API Keys section; click **Reveal** |

---

## 4. Environment Variables

### Create .env.local

In your project root, create `.env.local` (or copy from `.env.example`). Use this format:

```
SUPABASE_URL=https://yeonqwdnopluntzygotm.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_sb_secret_or_service_role_key
```

- **SUPABASE_URL** — From Project Settings → API (Project URL)
- **SUPABASE_SERVICE_ROLE_KEY** — Secret key (`sb_secret_...` or legacy `service_role`). Server-only; never expose to frontend.

### Verify .gitignore

`.env.local` must never be committed. It is listed in `.gitignore` (`.env*` and `.env.local`). Confirm with:

```bash
git check-ignore -v .env.local
```
Should output a .gitignore rule.

### Vercel

Add the same variables in **Project Settings → Environment Variables** for production.

### Our setup: server-only

**Remember:** This app uses **server-only** Supabase access. Env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Do NOT add `NEXT_PUBLIC_SUPABASE_*` until we add client-side Supabase (e.g. Auth).

For Document Intake we use the secret key only. No publishable/anon key in the frontend. If you add client-side Supabase later (e.g. Auth), you would also add:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

---

## 5. Key Formats and Security

### Publishable key (`sb_publishable_...` or `anon`)

- **Privileges:** Low — respects Row Level Security (RLS)
- **Safe for:** Web pages, mobile apps, CLIs, source code
- **Use when:** Client-side access with Supabase Auth or public RLS policies

### Secret key (`sb_secret_...` or `service_role`)

- **Privileges:** Full — bypasses RLS
- **Never expose in:** Browser, frontend, public URLs, chat, email
- **Use when:** Server Actions, API routes, Edge Functions, admin tools

### Legacy vs new format

| Legacy (JWT) | New format |
|--------------|------------|
| `anon` | `sb_publishable_...` |
| `service_role` | `sb_secret_...` |

Both work. New keys are preferred (easier to rotate, better security). Our app uses `SUPABASE_SERVICE_ROLE_KEY` — either the `service_role` JWT or `sb_secret_...` is fine.

---

## 6. Tables for Document Intake

Create these in **SQL Editor** (see [concept-document-intake.md](./concept-document-intake.md)):

```sql
-- uploads: stores document metadata and extracted text
CREATE TABLE uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  filename text NOT NULL,
  storage_path text,
  extracted_text text,
  language text,
  created_at timestamptz DEFAULT now()
);

-- task_suggestions: suggested tasks from model output
CREATE TABLE task_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id uuid REFERENCES uploads(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  title text NOT NULL,
  due_date date,
  note text,
  created_at timestamptz DEFAULT now()
);
```

---

## 7. Verify Setup

1. Add keys to `.env.local`
2. Restart dev server: `npm run dev`
3. Open Workspace → Developer Tools → **Open dev test page**
4. Click **Test Supabase** — you should see success with an inserted row ID

---

## 8. Supabase CLI (Optional)

Connect your local project to the remote Supabase project for migrations and schema management.

### Install

**Windows (npm, requires Node 20+):**
```bash
npm install supabase --save-dev
```
Then use `npx supabase` for all commands.

**Alternative (Scoop):**
```bash
scoop bucket add supabase https://github.com/supabase/cli.git
scoop install supabase
```

### Verify installation
```bash
npx supabase --version
```

### Initialize
```bash
cd c:\Dev\my-app
npx supabase init
```
Creates a `supabase/` folder with `config.toml` and `migrations/` for schema versioning.

### Login (required before link)

```bash
npx supabase login
```
Opens a browser to sign in to Supabase. The CLI stores an access token so it can connect to your projects.

### Link to remote project

**Find your project ref:** From your Supabase URL `https://xxxxx.supabase.co`, the project ref is `xxxxx`. Or open the dashboard — the URL is `https://supabase.com/dashboard/project/[PROJECT_REF]`.

```bash
npx supabase link --project-ref yeonqwdnopluntzygotm
```
You'll be prompted for your database password (the one you set when creating the project). This connects the local CLI to your remote Supabase project so you can push migrations, pull schema, etc.

### Verify connection
```bash
npx supabase status
```
Shows linked project and local/remote status.

---

## Troubleshooting: "Test Supabase" fails

### Error mentions "authentication" or "Invalid API key" or "JWT"

**Cause:** You're using the **publishable** (anon) key instead of the **secret** key.

**Fix:**
1. Dashboard → **Project Settings** (gear) → **API**
2. Find **Secret key** (or **service_role**). Click **Reveal**.
3. Copy the full key — format `sb_secret_...` or a long JWT.
4. Put it in `.env.local` as `SUPABASE_SERVICE_ROLE_KEY=...`
5. Restart dev server: stop `npm run dev`, then run it again.

### Error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"

**Fix:** Add both to `.env.local`. Restart the dev server (Next.js reads env only at startup).

### Error: "relation \"uploads\" does not exist"

**Fix:** Tables aren't created. Either run migrations (`npx supabase db push --linked`) or run the SQL from section 6 in Dashboard → SQL Editor.

### Error: "new row violates row-level security"

**Cause:** Using the publishable key (RLS applies). Use the **secret** key (bypasses RLS).

### "Connect" in the Dashboard doesn't work

The **Connect** button (top right) opens a modal with connection snippets. If it's blank or fails:
- Refresh the page
- Check you're in the correct project
- Try **Project Settings → API** for keys and URL

---

## References

- [Supabase API Keys docs](https://supabase.com/docs/guides/api/api-keys)
- [Supabase CLI docs](https://supabase.com/docs/guides/cli)
- [INTEGRATIONS.md](./INTEGRATIONS.md) — where keys are used in this project
