# Integrations & API Keys

**Purpose:** Central reference for external services and secure key storage.  
**Audience:** Developers and AI agents working on this project.

---

## Where to store secrets

| Location                                          | Use                                         | Committed?             |
| ------------------------------------------------- | ------------------------------------------- | ---------------------- |
| `.env.local`                                      | Local development keys                      | **No** (in .gitignore) |
| `.env.example`                                    | Template showing variable names (no values) | **Yes**                |
| Vercel → Project Settings → Environment Variables | Production/Preview keys                     | N/A                    |

**Rule:** Never commit real API keys. Reference them server-side only:

```ts
const apiKey = process.env.OPENAI_API_KEY;
```

---

## Setup for new integrations

1. Add the variable name to `.env.example` (no value).
2. Add your real key to `.env.local` locally.
3. Add the same variable in Vercel → Environment Variables for deploy.
4. Use it only in server code (Server Actions, API routes, server components).
5. Document the integration below.

---

## Current integrations

### OpenAI

- **Used for:** LLM drafting, document extraction, Whisper (voice-to-text).
- **Env key:** `OPENAI_API_KEY`
- **Where used:** `src/lib/openai.ts` (server-only)
- **Test:** Workspace → "Test API" section (dev)

---

## Validation & Security

- **Zod** schemas at `src/lib/schemas/` — validate all form inputs (email, locale) on client and server
- **Early access:** `earlyAccessSchema` enforces trim, min/max length (254), email format, allowed locales (en, de)
- **Outputs:** No `dangerouslySetInnerHTML`; user content rendered as text (React escapes)
- **Errors:** Validation failures return i18n keys; unexpected errors logged server-side only, generic message to user

## Current integrations (continued)

### Supabase

- **Used for:** Document Intake persistence (uploads, task_suggestions). Pre-login session storage.
- **Env keys (server):** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- **Env keys (client):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (optional; for Auth/Realtime)
- **Server client:** `src/lib/supabase-server.ts` — `createSupabaseAdmin()` — use in Server Actions, API routes
- **Browser client:** `src/lib/supabase-client.ts` — `createSupabaseBrowserClient()` — use in Client Components when needed
- **Where used:** `src/app/workspace/supabase-actions.ts` (server), Dev test page
- **Test:** Workspace → Developer tools → Dev test page → "Test Supabase"
- **Setup guide:** [supabase-setup.md](./supabase-setup.md)

**Security:**
- **Service role key** → Server only. Never expose. Bypasses RLS.
- **Publishable key** → Safe for browser. Respects RLS. Use for Auth, Realtime, user-scoped data.
- **Current usage:** Server-only for DB. Add `NEXT_PUBLIC_*` vars when adding client-side Auth/Realtime.

---

### n8n (workflows)

- **Used for:** Feedback processing with AI analysis, workflow automation, third-party integrations.
- **Env key:** `N8N_FEEDBACK_WEBHOOK_URL` (webhook URL from n8n Webhook Trigger node, lesson 5.4)
- **Where used:** 
  - `src/app/actions/feedback.ts` — Server Action sends feedback to n8n (outgoing webhook)
  - `src/app/api/webhooks/n8n/feedback/route.ts` — API route receives processed feedback from n8n (incoming webhook)
  - `src/components/feedback-modal.tsx` — Client form component
- **Setup guide:** [n8n-setup.md](./n8n-setup.md)
- **PRD:** [user-feedback/user-feedback-prd.md](./user-feedback/user-feedback-prd.md)
- **Current status:** Webhook integration complete (lesson 5.4). Security enhancements planned (lesson 5.5).

**Workflow structure (lesson 5.4):**
- Webhook Trigger → AI Tools Agent → Structured Output Parser → Auto-fixing Output Parser → Gmail → HTTP Request (callback to app)
- AI Agent uses OpenRouter (free models available)
- Returns structured JSON: `{ sentiment, category, priority, summary, actionable }`
- HTTP Request sends enriched data back to app webhook endpoint

**Security (lesson 5.5):**
- **Rate limiting:** 10 requests/minute per IP (in-memory, works for single server)
- **API key verification:** `X-API-Key` header verified against `N8N_WEBHOOK_SECRET`
- **Request logging:** All attempts logged with `[WEBHOOK]` prefix for monitoring
- **Environment variables:** `N8N_FEEDBACK_WEBHOOK_URL` (outgoing), `N8N_WEBHOOK_SECRET` (incoming verification)
- Webhook URL stored in env var (server-only)
- No API keys needed in app — n8n handles OpenRouter credentials internally
- **Security guide:** [webhook-security.md](./webhook-security.md)

---

---

### Clerk (auth + billing)

- **Used for:** Sign-in, sign-up, sessions, onboarding, Billing (subscriptions).
- **Billing:** `CLERK_WEBHOOK_SECRET` for webhook signature verification. See [payment-security.md](./payment-security.md).
- **Env keys:** `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` (plus sign-in/up URLs in .env).
- **Future projects / new Clerk app:** Add `*.vercel.app` to Clerk Dashboard → Configure → Domains. Covers all Vercel preview deployments in one go. Add once per Clerk application.

---

### Ahrefs (SEO) — **Deferred**

- **Status:** On backburner. API requires $500+/mo; no free tier. Scraping prohibited (ToS ban risk).
- **What exists:** `src/lib/ahrefs.ts`, `scripts/ahrefs-test.ts`, [ahrefs-setup.md](./ahrefs-setup.md)
- **For now:** Use manual research (Ubersuggest, Google Keyword Planner, Ahrefs UI export) → update `SEO-KEYWORDS.md` by hand.
- **Backlog:** [src/docs/seo/SEO-BACKLOG.md](./seo/SEO-BACKLOG.md)

---

## Planned (not yet wired)
- WhatsApp (Twilio)
- Slack
- Resend (email)

---

## File map for AI agents

```
.env.example              — Template: which env vars exist (no secrets)
.env.local                — Your actual keys (never commit; create from .env.example)
src/docs/INTEGRATIONS.md  — This file: setup guide and integration list
src/docs/supabase-setup.md — Supabase project creation, keys, and verification
src/docs/n8n-setup.md    — n8n workflow setup guide (lesson 5.2)
src/docs/mobile-responsive-testing.md — Mobile responsive testing guide (lesson 5.3)
src/docs/mobile-responsive-checklist.md — Quick testing checklist (lesson 5.3)
src/docs/webhook-security.md — Webhook security guide (lesson 5.5)
src/docs/payment-security.md — Payment security checklist (Clerk Billing, feature gates)
src/lib/openai.ts         — OpenAI client (server-only)
src/lib/supabase-server.ts — Supabase admin client (server-only)
src/lib/supabase-client.ts — Supabase browser client (client components; needs NEXT_PUBLIC_*)
src/lib/schemas/feedback.ts — Feedback schemas (form data + structured analysis types)
src/app/actions/feedback.ts — submitFeedback() server action (sends to n8n)
src/app/api/webhooks/n8n/feedback/route.ts — Webhook endpoint (receives from n8n)
src/app/workspace/supabase-actions.ts — testSupabaseConnection() server action
supabase/migrations/20260206000000_feedback_table.sql — Feedback table migration
src/app/workspace/actions.ts — testOpenAI() server action
src/app/workspace/api-test-card.tsx — UI to trigger API test (Workspace page, bottom)
src/components/feedback-modal.tsx — Feedback form component (lesson 5.1)
```
