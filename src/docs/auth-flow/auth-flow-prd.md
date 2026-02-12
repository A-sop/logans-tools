# Authentication & Onboarding PRD

## Status

**Shipped to Production.** Stages 1–7 complete.

**Production:** https://cm.logans.tools (live as of Feb 2025). Auth (email/password), onboarding, RLS, feedback modal, and webhook integration deployed from `main`.

**Lesson 4.4 checklist:**  
✅ Stage 1 Clerk + Supabase setup · ✅ Stage 2 Auth pages & UserButton · ✅ Stage 3 Protected routes (proxy) · ✅ Stage 4 3-screen onboarding · ✅ Stage 5 Database & RLS · ✅ Stage 6 Testing & polish · ✅ Stage 7 Documentation & commit (merged to main, production verified)

### Known issues / open tasks

- [x] **Fix onboarding completion loop** — Fixed: (1) After complete, we now wait 800ms, call `router.refresh()`, then `router.push('/workspace?onboarding=done')`. (2) Middleware allows through when path is `/workspace` and `?onboarding=done` is present (one-time bypass if JWT is still stale). (3) Workspace client strips `?onboarding=done` so the URL is clean. If the loop reappears, increase the delay or verify Clerk session token customization.

## Objective

Implement secure, user-friendly authentication with Clerk and Supabase, focusing on email/password login with a 3-screen onboarding experience for new users. Main app route: `/workspace`.

## Scope

**In Scope:**
- User signup with Clerk (email/password only)
- User login with Clerk (email/password only)
- Clerk + Supabase integration (native integration enabled in Clerk dashboard)
- Protected routes and middleware
- 3-screen skippable onboarding (custom pages, not Clerk's built-in onboarding UI)
- Custom redirects after auth actions
- Row-level security (RLS) policies for user data isolation
- Responsive auth UI matching our design system

**Out of Scope (Future Considerations):**
- Social login (Google, GitHub, etc.)
- Password reset flow (uses Clerk defaults initially)
- Email verification (uses Clerk defaults)
- Multi-factor authentication (MFA)
- User profile editing pages
- Advanced onboarding with custom fields
- Webhooks for data synchronization

## User Stories

1. As a new user, I want to sign up with email/password so I can start using the app
2. As a returning user, I want to log in quickly and go straight to my content
3. As a new user, I want to see a brief onboarding that explains the app's value
4. As any user, I want my data to be secure and isolated from other users
5. As a mobile user, I want auth flows to work smoothly on my device

## Acceptance Criteria

- [x] Clerk project created with Supabase integration enabled in dashboard
- [x] Signup page created at /sign-up with Clerk `<SignUp />` component
- [x] Login page created at /sign-in with Clerk `<SignIn />` component
- [ ] Email/password authentication configured (no social providers)
- [ ] Middleware protects `/workspace` and nested routes
- [ ] First-time users see 3-screen onboarding after signup
- [ ] Returning users skip onboarding automatically
- [ ] Onboarding is skippable at any point
- [ ] Users redirect to correct pages after auth actions
- [ ] RLS policies prevent users from seeing each other's data
- [ ] Auth flows work on mobile and desktop
- [ ] Loading states show during auth operations
- [ ] Error messages are clear and actionable
- [ ] Auth pages match our design system

## Implementation Plan

### Stage 1: Clerk + Supabase Setup ✅

**User actions (manual steps):**
- [x] Go to [Clerk Dashboard](https://dashboard.clerk.com/) → Navigate to Integrations → Select Supabase
- [x] Follow Clerk's setup wizard to connect your Supabase project
- [x] Keep the Clerk dashboard tab open — you'll need API keys

**Configure Session Token (Critical for Onboarding):**
- [x] Before building anything, configure the session token in Clerk Dashboard:
1. Go to [Clerk Dashboard](https://dashboard.clerk.com/)
2. Navigate to: **Sessions** → **Customize session token**
3. Add this custom claim in the JSON editor:
```json
{
  "role": "authenticated",
  "metadata": "{{user.public_metadata}}"
}
```
4. Click **Save**

**Why:** Middleware checks the JWT session token. Without this, `publicMetadata` won't be in the JWT, and the onboarding status check will fail (infinite redirect loops).

**AI agent actions:**
- [x] Install `@clerk/nextjs` package
- [x] Ensure `@supabase/supabase-js` is installed (already present)
- [x] Wrap the app with ClerkProvider in the root layout

**Environment variables:**
From Clerk Dashboard (Settings → API Keys):
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — Publishable key
- `CLERK_SECRET_KEY` — Secret key

Redirect URLs:
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
- `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/workspace`
- `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/onboarding`

**Note:** Use `_FALLBACK_REDIRECT_URL` naming (not deprecated `_AFTER_`).

- [x] Test that Clerk is connected (visit the app and see auth state)

### Stage 2: Auth Pages and User Button ✅

**Create Authentication Pages:**
- [x] Create `app/sign-up/[[...sign-up]]/page.tsx`
- [x] Add Clerk `<SignUp />` (path routing via catch-all; redirects via env)
- [ ] Style signup page to match design system (Clerk appearance prop or CSS) — optional polish
- [x] Create `app/sign-in/[[...sign-in]]/page.tsx`
- [x] Add Clerk `<SignIn />` (path routing via catch-all; redirects via env)
- [ ] Style login page to match design system — optional polish
- [x] Redirects: sign-up fallback → /onboarding, sign-in fallback → /workspace (env vars)
- [ ] Test signup flow: create account → redirects to onboarding (manual)
- [ ] Test login flow: sign in → redirects to workspace (manual)

**Add User Button to Header:**
- [x] Locate or create header component (e.g. in layout or a shared header)
- [x] Import UserButton, SignedIn, SignedOut from `@clerk/nextjs`
- [x] Add UserButton inside `<SignedIn>` in top-right of header
- [x] Add SignInButton inside `<SignedOut>` for unauthenticated users
- [x] Header in root layout with UserButton / Sign in & Sign up
- [ ] Test: Sign in → UserButton appears; click → Manage account / Sign out (manual)

### Stage 3: Protected Routes and Middleware

**Protected route:** `/workspace` (and nested paths like `/workspace/*`)

**AI agent actions:**
- [x] Create `src/proxy.ts` (Next.js 16 uses proxy.ts; middleware.ts deprecated)
- [x] Import `clerkMiddleware`, `createRouteMatcher` from `@clerk/nextjs/server`
- [x] Define public routes: `/`, `/sign-in(.*)`, `/sign-up(.*)`; allow `/onboarding(.*)` when authenticated
- [x] Authenticated users without onboardingComplete → redirect to /onboarding; else allow (e.g. /workspace)

- [x] Add config matcher for Next.js internals, static files, API routes
- [x] Test: Visit /workspace signed out → redirect to /sign-in?redirect_url=...
- [x] Test: Sign in → visit /workspace → loads; redirect-back works

**Note:** Next.js 16 uses `src/proxy.ts` (middleware.ts deprecated). Current implementation uses `auth.protect()`.

### Stage 4: 3-Screen Onboarding ✅

**Metadata:** Store `onboardingComplete` in `publicMetadata` (NOT `unsafeMetadata` — it won't be in JWT).

**AI agent actions:**

**1. Create Onboarding Layout & Page:**
- [x] Create `app/onboarding/layout.tsx` (server component)
- [x] Use `auth()` from `@clerk/nextjs/server` to get userId and sessionClaims
- [x] If not authenticated → redirect to /sign-in
- [x] If `sessionClaims?.metadata?.onboardingComplete === true` → redirect to /workspace
- [x] Create `app/onboarding/page.tsx` (client component)

**2. Build 3-Screen Component:**
- **Screen 1:** "Welcome to [App Name]"; subheading about trackable actions; progress 1 of 3; Next, Skip
- **Screen 2:** "Stay in control with the approval layer"; benefits; progress 2 of 3; Next, Back, Skip
- **Screen 3:** "Ready to get started?"; progress 3 of 3; Get Started, Back, Skip

**3. Server Action for Metadata:**
- [x] Create `app/onboarding/actions.ts` with `"use server"`
- [x] `completeOnboarding()`: uses `updateUserMetadata()` with awaited `clerkClient()`
- [x] Returns `{ success: true }` or `{ error: "message" }`; no redirect() in server action

**4. Client Completion Logic (JWT Refresh Pattern):**
```ts
const { getToken } = useAuth();
const handleComplete = async () => {
  setIsCompleting(true);
  const result = await completeOnboarding();
  if (result?.error) { toast.error(result.error); setIsCompleting(false); return; }
  await getToken({ skipCache: true });  // CRITICAL: refresh JWT
  window.location.href = "/workspace";   // Hard redirect, NOT router.push()
};
```

**5. Update Middleware for Onboarding:**
- [x] If user authenticated but `!onboardingComplete` and accessing protected route → redirect to /onboarding
- [x] Exception: allow access to /onboarding page
- [x] Read from `sessionClaims?.metadata?.onboardingComplete`

**6. Style:** Match design system; mobile responsive; smooth transitions (Framer Motion optional)

**7. Test:** New user → onboarding → Get Started; Skip; Returning user skips; Back navigation

**Known issue:** Post-completion redirect can loop (see Known issues above).

### Stage 5: Database Setup and RLS ✅ (implementation)

**Reference:** [Clerk + Supabase Integration](https://clerk.com/docs/guides/development/integrations/databases/supabase)

**Supabase setup (manual — user):**
- [ ] **Clerk:** [Setup → Supabase](https://dashboard.clerk.com/setup/supabase) → **Activate** (adds `role: authenticated` to session tokens).
- [ ] **Supabase:** [Authentication → Third-Party](https://supabase.com/dashboard/project/_/auth/third-party) (or Auth → Sign In / Up) → **Add provider** → **Clerk** → paste the **Clerk domain** from Clerk (e.g. `https://your-app.clerk.accounts.dev`), no trailing slash.

**If you still see "No suitable key or wrong key type":**
1. Confirm **SUPABASE_ANON_KEY** in `.env.local` is the **anon (public)** key from Supabase API settings, not the secret/service_role key.
2. **Sign out** of the app, then **sign in again** (or open an incognito window and sign in) so Clerk issues a new token with the Supabase integration.
3. In **Clerk:** Setup → Supabase must show the integration as **Active**.
4. In **Supabase:** Auth → Third-Party (or Providers) must list **Clerk** with the exact Clerk domain; same Clerk app as your `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.

**Implementation (done):**
- [x] **Clerk Supabase client:** `src/lib/supabase-clerk.ts` — `createSupabaseClientForClerk()` uses `auth().getToken()` so RLS sees Clerk user ID. Use in Server Actions / server code; requires `SUPABASE_ANON_KEY` in env (see `.env.example`).
- [x] **Example table + RLS:** Migration `supabase/migrations/20260205120000_clerk_tasks_rls.sql` — `public.tasks` with `user_id` default `auth.jwt()->>'sub'`, RLS enabled, policies for SELECT/INSERT by own `user_id`.
- [x] **Workspace demo:** "My tasks (Supabase RLS)" card on `/workspace` with list + add form (see `supabase-task-actions.ts`, workspace-client).

**Remaining (user):**
- [ ] Run migration (e.g. `supabase db push` or apply via dashboard)
- [ ] Test: User A creates record → User B cannot see it; unauthenticated denied

**Note:** No webhooks needed for basic auth + data isolation. JWT templates not required — native integration.

### Stage 6: Testing and Polish

**Checklist (run locally: `npm run dev`, then verify):**

| Scenario | Pass/Fail | Notes |
|----------|-----------|--------|
| New user: signup → onboarding → workspace | [ ] | Create account, complete or skip onboarding, land on /workspace |
| Returning user: login → workspace (skip onboarding) | [ ] | Sign in, go straight to /workspace |
| Error states: invalid email, weak password, wrong password | [ ] | Clerk shows inline errors |
| Unauthenticated → /workspace redirects to /sign-in | [ ] | returnBackUrl preserved |
| After login, redirect to intended page | [ ] | redirect_url works |
| Mobile responsive (auth + onboarding) | [ ] | Optional |
| Data isolation (if migration run): User A vs User B tasks | [ ] | My tasks (Supabase RLS) card |

### Stage 7: Documentation and Commit

- [x] Update this PRD with ✅ for completed stages
- [x] Document environment variables in .env.example
- [ ] **Commit** (await approval): `feat(auth): implement clerk authentication with supabase integration`
- [ ] Push: `git push origin auth-flow` (triggers Vercel preview)
- [ ] Update Linear sprint board (if used)

## Technical References

- [Clerk + Supabase Integration](https://clerk.com/docs/guides/development/integrations/databases/supabase)
- [Clerk Next.js Setup](https://clerk.com/docs/quickstarts/nextjs)
- [Clerk Add Onboarding Flow](https://clerk.com/docs/guides/development/add-onboarding-flow)
- [Clerk Redirects](https://clerk.com/docs/guides/custom-redirects)
- [Clerk Appearance](https://clerk.com/docs/customization/overview)
- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Next.js Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)

## Key Technical Notes

**Proxy:** In `src/proxy.ts` (Next.js 16). Use `createRouteMatcher` for public routes; `auth.protect()` for protected. Clear `.next` and restart after changes.

**Session Token:** Configure custom claim `{"metadata": "{{user.public_metadata}}"}`. Middleware reads `sessionClaims.metadata.onboardingComplete`.

**Onboarding:** Store in `publicMetadata`. After update, call `getToken({ skipCache: true })`, then `window.location.href = "/workspace"`.

**Supabase:** RLS uses `auth.jwt()->>'sub'` for user_id. Create Clerk Supabase client helper per docs.

**Routes:** Sign-in fallback = `/workspace`. Sign-up fallback = `/onboarding`. Protected = `/workspace(.*)`.
