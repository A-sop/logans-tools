# Authentication User Journey Map

**App context:** Assistive workspace for independent professionals—turns messages, documents, and requests into clear, trackable actions. Target audience: visually impaired professionals managing high volumes of incoming work.

**References:** [concept.md](../concept.md), [auth-ux-research.md](./auth-ux-research.md)

---

## Implementation Details (Clerk + Supabase)

| Setting | Value |
|---------|-------|
| **Authentication** | Email and password only (social login = future scope) |
| **Signup route** | `/sign-up` |
| **Login route** | `/sign-in` |
| **After signup** | Redirect → `/onboarding` |
| **After login** | Redirect → `/workspace` (or `redirect_url` if set) |
| **Main app** | `/workspace` (protected) |
| **Clerk components** | `<SignUp />`, `<SignIn />`, `<UserButton />` |
| **Supabase integration** | Enable Clerk's native Supabase integration in Clerk dashboard |
| **Onboarding** | Clerk's native onboarding feature; 3 screens; `publicMetadata.onboardingComplete` |

---

## New User Path

### 1. Landing page (unauthenticated)

| | |
|---|---|
| **User sees** | Hero ("Delegate the Chaos. Keep the Control."), Coming Soon badge, value proposition, "Open Workspace" CTA, EN/DE language toggle |
| **Actions** | Click "Open Workspace", switch language, scroll |
| **Next** | CTA → signup or workspace (depending on protection rules) |
| **Decision** | If workspace is protected, redirect to signup or sign-in choice |

### 2. Clicks "Get Started" or similar CTA

| | |
|---|---|
| **User sees** | Clear prompt to create an account (or option to log in if they have one) |
| **Actions** | Click "Get Started" / "Sign Up" → go to signup page |
| **Next** | Navigate to `/sign-up` |
| **Decision** | May offer "Already have an account? Log in" link |

### 3. Signup page (`/sign-up`)

| | |
|---|---|
| **User sees** | Clerk `<SignUp />` component: email, password; "Create Account" button |
| **Implementation** | `app/(auth)/sign-up/[[...sign-up]]/page.tsx`; `routing="path"`; path `/sign-up` |
| **Actions** | Enter email, enter password, submit |
| **Next** | Account created → redirect to `/onboarding` (env: `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL`) |
| **Decision** | Invalid input → Clerk inline errors; valid → proceed |

### 4. Account creation

| | |
|---|---|
| **User sees** | Processing/loading state; success confirmation |
| **Actions** | Wait; optionally verify email (if Clerk verification enabled) |
| **Next** | First login / session start → redirect to onboarding |
| **Decision** | Success → onboarding; verification pending → check email flow (Clerk handles) |

### 5. First login / session start

| | |
|---|---|
| **User sees** | Brief transition; session established |
| **Actions** | (Automatic) |
| **Next** | Redirect to onboarding (new users) |
| **Decision** | Metadata `onboardingComplete: false` → onboarding; `true` → main app |

### 6. Onboarding (3 screens explaining core value)

**Screen 1 — Welcome**
| | |
|---|---|
| **Headline** | Welcome to [App Name] |
| **Subheading** | Turn messages, documents, and requests into clear, trackable actions—so nothing slips through the cracks. |
| **Visual** | Icon or illustration |
| **Progress** | 1 of 3 |
| **Buttons** | Next (primary), Skip (secondary) |

**Screen 2 — Key feature**
| | |
|---|---|
| **Headline** | Stay in control with the approval layer |
| **Supporting text** | Sensitive updates and outbound communications go through you. Review and approve before anything goes out. |
| **Tip** | Your assistant handles the chaos; you decide what happens next. |
| **Visual** | Icon or illustration |
| **Progress** | 2 of 3 |
| **Buttons** | Next (primary), Back (ghost), Skip (secondary) |

**Screen 3 — Get started**
| | |
|---|---|
| **Headline** | Ready to get started? |
| **Supporting text** | Your workspace is waiting. Create your first assignment or explore the dashboard. |
| **Visual** | Icon or illustration |
| **Progress** | 3 of 3 |
| **Buttons** | Get Started (primary), Back (ghost), Skip (secondary) |

**Completion:** Get Started or Skip → `publicMetadata.onboardingComplete = true` → redirect to `/workspace`

### 7. Main app experience

| | |
|---|---|
| **User sees** | Workspace at `/workspace`: assignments, tasks, documents; header with Clerk `<UserButton />` (avatar, profile, sign out) |
| **Actions** | Use workspace; click UserButton → Manage account / Sign out |
| **Next** | Ongoing use; sign out → landing or sign-in |
| **Decision** | — |

---

## Returning User Path

### 1. Direct visit or login page

| | |
|---|---|
| **User sees** | Landing page or direct link to `/sign-in` |
| **Actions** | Click "Log In" or "Open Workspace" (if protected) → sign-in page |
| **Next** | `/sign-in` |
| **Decision** | If already signed in → redirect to main app |

### 2. Login (`/sign-in`)

| | |
|---|---|
| **User sees** | Clerk `<SignIn />` component: email, password; "Log In" button |
| **Implementation** | `app/(auth)/sign-in/[[...sign-in]]/page.tsx`; `routing="path"`; path `/sign-in` |
| **Actions** | Enter credentials, submit |
| **Next** | Valid → redirect to `/workspace` or `redirect_url`; invalid → Clerk error |
| **Decision** | Success → middleware checks `onboardingComplete`; fail → inline error |

### 3. Skip onboarding (already seen)

| | |
|---|---|
| **User sees** | (Automatic) Middleware checks `onboardingComplete` in session |
| **Actions** | (Automatic) |
| **Next** | Redirect directly to `/workspace` |
| **Decision** | `onboardingComplete: true` → main app; `false` → onboarding |

### 4. Main app experience

| | |
|---|---|
| **User sees** | Workspace at `/workspace` |
| **Actions** | Use workspace; sign out |
| **Next** | — |
| **Decision** | — |

---

## Error States

### Invalid credentials

| | |
|---|---|
| **User sees** | Inline error near form: "Invalid email or password. Please try again." |
| **Actions** | Re-enter credentials; click "Forgot password?" (Clerk default) |
| **Next** | Retry login; or password reset flow |
| **Recovery** | Clear, actionable message; no modal |

### Email already exists

| | |
|---|---|
| **User sees** | Inline error: "An account with this email already exists. Log in instead." |
| **Actions** | Click link to sign-in page; or enter different email |
| **Next** | Navigate to `/sign-in` |
| **Recovery** | Direct path to login |

### Network errors

| | |
|---|---|
| **User sees** | Inline or toast: "Connection failed. Please check your internet and try again." |
| **Actions** | Retry; refresh page |
| **Next** | Resubmit form |
| **Recovery** | Retry button; don't lose form data if possible |

### Session expired

| | |
|---|---|
| **User sees** | Redirect to sign-in with message: "Your session expired. Please sign in again." |
| **Actions** | Sign in again |
| **Next** | Redirect back to original destination after login (`redirect_url`) |
| **Recovery** | Preserve intended destination; smooth re-auth |

---

## Flow Diagram (Simplified)

```
Landing (unauthenticated)
    │
    ├── "Open Workspace" / "Get Started"
    │       │
    │       ├── No account? ──► /sign-up ──► Account created ──► /onboarding (3 screens)
    │       │                                                        │
    │       │                                                        ├── Get Started / Skip ──► /workspace
    │       │                                                        └── Back / Next (navigate screens)
    │       │
    │       └── Has account? ──► /sign-in ──► Session start
    │                                    │
    │                                    ├── onboardingComplete? ──► /workspace
    │                                    └── else ──► /onboarding ──► /workspace
    │
    └── Direct /workspace (protected)
            │
            └── Not signed in ──► /sign-in?redirect_url=/workspace
```

---

## Friction Points to Minimize

1. **First-time:** Show value before signup; minimal fields; fast onboarding with skip
2. **Returning:** One-click path from landing to login; no re-onboarding
3. **Errors:** Inline, clear, with recovery path (e.g. "Log in instead")
4. **Session:** Preserve `redirect_url` so users land where they intended

---

## Integration Notes

- **Clerk ↔ Supabase:** Enable Clerk's Supabase integration in the Clerk dashboard (Integrations → Supabase). Clerk session tokens include claims Supabase uses for RLS; no webhooks needed for basic auth + data isolation.
- **Session token:** Configure custom claim in Clerk (Sessions → Customize session token) to include `publicMetadata` so middleware can read `onboardingComplete`.
