# Payment Security Checklist

**Purpose:** Reference for payment system security. Use when auditing or before production.

---

## Current Safeguards

### 1. Webhook signature verification
- **Location:** `src/app/api/webhooks/clerk/route.ts`
- **Mechanism:** Clerk uses Svix to sign webhook payloads. We verify with `verifyWebhook(req, { signingSecret })` before processing.
- **Secret:** `CLERK_WEBHOOK_SECRET` in `.env.local` and Vercel env vars. Never commit.
- **Route:** `/api/webhooks/clerk` is **public** (no auth) so Clerk can POST; verification is by signature only.

### 2. Feature gating
- **Location:** `src/proxy.ts` (middleware)
- **Mechanism:** `has({ plan: 'cm_operator' })` from Clerk — workspace access only if user has active subscription.
- **Fallback:** Redirect to `/pricing?reason=workspace` when not subscribed.

### 3. Secrets
- **CLERK_WEBHOOK_SECRET** — Webhook signing. Server-only.
- **SUPABASE_SERVICE_ROLE_KEY** — Webhook writes to subscriptions table. Server-only.
- **CLERK_SECRET_KEY** — Clerk server API. Server-only.
- All in `.env.local` (gitignored) and Vercel Environment Variables.

### 4. Public routes (no auth required)
- `/` — Home
- `/sign-in`, `/sign-up` — Auth
- `/pricing` — Pricing page
- `/changelog` — Changelog
- `/api/webhooks/*` — Webhooks (verify via signature, not auth)

---

## Human verification checklist (before production)

- [ ] **A-54:** Test that feature gates can't be bypassed (e.g. direct URL, modified requests)
- [ ] **A-59:** Final security checklist — webhook verified, production secrets set, no secrets in client code
- [ ] **Webhook events:** Ensure Clerk webhook subscribes to `subscription.*` and `subscriptionItem.*` events
- [ ] **Production env:** `CLERK_WEBHOOK_SECRET` and Stripe keys set in Vercel for production

---

## Related

- `src/docs/INTEGRATIONS.md` — Env vars and integrations
- `src/docs/webhook-security.md` — n8n feedback webhook security
- Linear A-53, A-54, A-55, A-59 — Payment security issues
