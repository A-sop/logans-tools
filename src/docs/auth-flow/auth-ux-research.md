# Auth UX Research — 2025 Best Practices

Research summary for designing the authentication and onboarding flow. Based on [Authgear 2025 Guide](https://www.authgear.com/post/login-signup-ux-guide), [web.dev form best practices](https://web.dev/articles/sign-up-form-best-practices), [Clerk docs](https://clerk.com/docs/customization/elements/examples/sign-up), [Material Design onboarding](https://m2.material.io/design/communication/onboarding.html), and [Mobbin Uber onboarding example](https://mobbin.com/explore/flows/4ad908cc-ad45-4e29-b906-841b405495cf).

---

## Key patterns to follow

### 1. Clarity and minimal friction
- **Labels:** Clear "Create Account" vs "Log In" — users always know what step they're on
- **Minimal fields:** Only required fields at signup; avoid double-entry (use email verification instead)
- **Progressive disclosure:** Show value and benefits before asking for signup
- **Stats:** 88% of users won't return after a bad UX; poor login is a top abandonment driver

### 2. Trust and security signals
- **Password handling:** Allow paste, offer reveal button, never plain text
- **Autocomplete:** Use `autocomplete="email"`, `autocomplete="new-password"` for accessibility
- **Visible security:** Subtle trust cues (e.g. "Secure sign-in") without overloading
- **Error recovery:** Clear, actionable error messages next to fields — not modals or top-of-form only

### 3. Onboarding: short, skippable, benefit-focused
- **3–5 screens:** Focus on core value, not every feature. Slack, Cryb use skip at any point
- **Progress indicators:** "1 of 3" — users need to know where they are
- **Skippable:** Modern best practice — let users skip to main app; don't force education
- **Front-loaded value:** Show benefits immediately; sensible defaults reduce setup burden

### 4. Mobile-responsive auth
- **Touch targets:** Adequate size (min 44px); adequate spacing
- **Keyboard:** Ensure mobile keyboards don't obscure inputs
- **Legible text:** Readable font sizes, contrast
- **One-column layout:** Stack fields vertically on small screens

### 5. Error handling and recovery
- **Inline validation:** Show errors after field completion, not while typing
- **Field-adjacent messages:** Errors next to the field, with clear fix instructions
- **Client + server validation:** Real-time feedback + server-side security
- **Accessibility:** `aria-label`, `aria-describedby`, keyboard navigation
- **Repeated errors:** Extra help if user hits same error multiple times

---

## Patterns to avoid

### 1. Friction and cognitive load
- **Double-entry:** Don't ask for email/password twice — use verification flow instead
- **Long onboarding:** 23 screens (like Uber's full flow) is too much for most web apps — keep ours to 3
- **Disabled paste:** Never block password pasting — hurts password managers and accessibility
- **Premature errors:** Don't show validation errors while user is still typing

### 2. Poor error and recovery UX
- **Modals for errors:** Interrupts workflow; use inline messages
- **Vague messages:** "Something went wrong" — provide actionable instructions
- **Top-only summaries:** Users need errors next to fields to fix them quickly
- **No recovery path:** Password reset flows lose 75% of users; make them clear and simple

### 3. Inconsistent or inaccessible design
- **Ignoring IDP guidelines:** Social buttons (Google, Apple) have strict branding — follow them
- **Poor contrast:** Errors and labels must meet WCAG contrast
- **Missing semantic HTML:** Use `<form>`, `<label>`, proper `<input>` types

---

## Examples from well-known apps

| App | Pattern |
|-----|---------|
| **Slack** | Skip option at any point in onboarding |
| **Cryb** | Skip option; short walkthrough |
| **Clerk** | Pre-built SignIn/SignUp with routing, validation, OAuth |
| **Uber (Mobbin)** | Full flow: permissions → account → payment → main app (23 screens — too long for our case) |
| **Google** | "Sign in with Google" — prominent placement, follows IDP branding |

---

## Mobbin Uber onboarding — insights

The [Uber iOS onboarding flow](https://mobbin.com/explore/flows/4ad908cc-ad45-4e29-b906-841b405495cf) covers permissions, account creation, payment setup, and reaching the main app.

**What to adopt:**
- **Progress:** Clear screen numbering (1 of 23, etc.) — we'll use "1 of 3"
- **Transitions:** Smooth screen-to-screen flow
- **Completion:** Clear "next step" at the end

**What to avoid:**
- **Length:** 23 screens is excessive for a web app — we'll use 3 benefit-focused screens
- **Scope:** Uber mixes onboarding + account setup + payment — we separate auth from product setup

**For our flow:** Use 3 screens: Welcome → Key feature → Get started. Each with Next, Back, Skip. Progress indicator. Final CTA lands user in main app.

---

## Clerk-specific notes

- **Use all-in-one components:** `<SignUp />` and `<SignIn />` — Clerk Elements (low-level) are deprecated
- **Email/password + verification:** Clerk's default flow; configure redirects for onboarding
- **Appearance prop:** Style to match our design system (Level 3)
- **Routes:** `/sign-up`, `/sign-in` — standard, predictable

---

## Actionable for implementation

1. **Signup:** Minimal fields (email, password); Clerk handles verification
2. **Login:** Fast path; clear "Forgot password?" link
3. **Onboarding:** 3 screens, progress indicator, Next/Back/Skip on each
4. **Errors:** Inline, field-adjacent, clear instructions
5. **Mobile:** Test touch targets, keyboard overlap, one-column layout
6. **Social (future):** If added, use official Google/Apple button guidelines; place prominently
