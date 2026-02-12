# Data isolation verification (4.5)

**Last checked:** After merge to main and production go-live. Ensures users cannot see each other's data.

---

## Summary: ✅ Correct

- **Tasks** and **workspace_documents** are protected by Supabase RLS using the Clerk user ID (`auth.jwt()->>'sub'`).
- **Server actions** use `auth()` to get `userId` and pass it on insert; they never accept `user_id` from the client.
- **Supabase client** is always `createSupabaseClientForClerk()`, which sends the Clerk JWT so RLS sees the correct user.

---

## 1. RLS policies (Supabase)

| Table                 | SELECT | INSERT | UPDATE/DELETE |
|-----------------------|--------|--------|----------------|
| `tasks`               | ✅ Own rows only (`auth.jwt()->>'sub' = user_id`) | ✅ Must insert own `user_id` | Not used in app yet |
| `workspace_documents`  | ✅ Own rows only | ✅ Must insert own `user_id` | Not used in app yet |
| `feedback`            | ✅ Own or `user_id IS NULL` | ✅ Own or NULL | Not used in app |

- **tasks:** `20260205120000_clerk_tasks_rls.sql`
- **workspace_documents:** `20260206120000_workspace_documents.sql`
- **feedback:** `20260206000000_feedback_table.sql`
- **uploads / task_suggestions:** RLS enabled, no permissive policies (access only via service_role if needed).

---

## 2. Application code

- **getSupabaseTasks / getWorkspaceDocuments:** Use `createSupabaseClientForClerk()` only. No `user_id` in query; RLS filters to current user.
- **addSupabaseTask:** `userId` from `auth()` (server-only), then `insert({ name, user_id: userId })`. RLS `with check` would reject a wrong `user_id`.
- **uploadWorkspaceDocument:** Same — `userId` from `auth()`, insert with `user_id: userId`.

No route or action accepts `user_id` (or any user identifier) from the client for queries or inserts.

---

## 3. Manual test (4.5)

From `human-todos.md`:

1. Log in as **User A** → create a task and/or upload a document on workspace.
2. Log out.
3. Log in as **User B** (different account).
4. Confirm User B does **not** see User A's tasks or documents.

Run this on production (https://cm.logans.tools) or locally with two different Clerk accounts.

---

## 4. When you add update/delete

If you add "edit task" or "delete document" later, add matching RLS policies, e.g.:

- `for update using (auth.jwt()->>'sub' = user_id)`
- `for delete using (auth.jwt()->>'sub' = user_id)`

And in server actions, only allow update/delete by id; never trust a client-supplied `user_id`.
