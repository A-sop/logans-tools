# Stage 7: Documentation and Commit Summary

## 1. PRD status

- **Stages 1–5:** ✅ Implementation complete (see `auth-flow-prd.md`).
- **Stage 6:** Test checklist added to PRD; run locally and tick off.
- **Stage 7:** PRD updated, env documented, commit message proposed below.

---

## 2. Files created or modified (auth implementation)

### New files

| File | Purpose |
|------|--------|
| `src/lib/supabase-clerk.ts` | Clerk-authenticated Supabase client for RLS (`createSupabaseClientForClerk`) |
| `src/app/workspace/supabase-task-actions.ts` | Server actions: `getSupabaseTasks`, `addSupabaseTask` |
| `supabase/migrations/20260205120000_clerk_tasks_rls.sql` | `public.tasks` table + RLS policies (user_id from JWT) |

### Modified files (this session)

| File | Change |
|------|--------|
| `.env.example` | Added `SUPABASE_ANON_KEY` for Clerk + RLS |
| `src/app/onboarding/page.tsx` | JWT refresh + 300ms delay before redirect (loop fix) |
| `src/app/workspace/page.tsx` | Fetch Supabase tasks, pass to client |
| `src/app/workspace/workspace-client.tsx` | “My tasks (Supabase RLS)” card + add form |
| `src/docs/agent-whats-next.md` | Stage 5 / RLS task note |
| `src/docs/auth-flow/auth-flow-prd.md` | Status, Stage 2–5 checkmarks, Stage 6 checklist, Stage 7 items |

### Existing auth-related files (already in repo)

| File | Purpose |
|------|--------|
| `src/app/layout.tsx` | ClerkProvider, UserButton, SignInButton, SignUpButton |
| `src/app/sign-in/[[...sign-in]]/page.tsx` | SignIn component |
| `src/app/sign-up/[[...sign-up]]/page.tsx` | SignUp component |
| `src/proxy.ts` | Route protection, onboarding redirect |
| `src/app/onboarding/layout.tsx` | Auth + onboardingComplete check |
| `src/app/onboarding/actions.ts` | completeOnboarding() server action |

---

## 3. Environment variables for Vercel

Set these in the Vercel project (Settings → Environment Variables). Use the same names in Production and Preview.

| Variable | Required | Notes |
|----------|----------|--------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key |
| `CLERK_SECRET_KEY` | Yes | Clerk secret key (not exposed to client) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Yes | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Yes | `/sign-up` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | Yes | `/workspace` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | Yes | `/onboarding` |
| `SUPABASE_URL` | Yes (if using Supabase) | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | If using admin client | Server-only |
| `SUPABASE_ANON_KEY` | If using Clerk + RLS | For `createSupabaseClientForClerk()` |

**Production:** Use a custom domain for Clerk (not `*.vercel.app`) as per the lesson.

---

## 4. Proposed commit message

```
feat(auth): implement clerk authentication with supabase integration

- Clerk sign-in/sign-up, UserButton, protected routes (proxy.ts)
- 3-screen onboarding with publicMetadata and JWT refresh
- Clerk + Supabase RLS: supabase-clerk client, tasks table migration
- Workspace "My tasks" demo for RLS; onboarding redirect loop fix

Stages 1–5 of auth-flow PRD. Branch: auth-flow.
```

---

## 5. After you approve

1. **Commit:**  
   `git add -A` then commit with the message above (or your variant).
2. **Push:**  
   `git push origin auth-flow`
3. **Preview:**  
   Vercel will build a preview deployment for `auth-flow`.
4. **Do not merge to main** until Lesson 4.6 (preview and production).

---

*Do not commit until you have approved the message and run the Stage 6 tests you want.*
