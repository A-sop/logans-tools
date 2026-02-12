# Human dev to-dos

**⚠️ DEPRECATED: This document has been migrated to Linear.** All tasks have been converted to Linear issues. This file is kept for reference only and will be removed once migration is verified complete.

**Migration Status:** ✅ Complete (2026-02-09)
- All tasks from this document have been created as Linear issues
- Reference sections preserved below for context
- See Linear workspace for active task tracking

**Linear Issues Created:**
- A-12: Security Verification (4.5)
- A-13: Production Deployment (4.6)
- A-14 to A-25: Level 5 tasks (Feedback System)
- A-26 to A-63: Level 6 tasks (Payment System)
- A-64: Future Features (Document Generation Tool)
- A-65: Quick Test (Clerk + Supabase)

---

## Auth — reference (no checkboxes)

**App:** Main route `/workspace`. Env: `SUPABASE_ANON_KEY` for Clerk+RLS.

**Security model (4.5):** Clerk = who you are (JWT). Supabase RLS = what you can access (rows where `user_id` = JWT `sub`).

**Environments (4.6):** Local → Preview (`auth-flow-*.vercel.app`) → Production (custom domain). Clerk: Development keys for Local+Preview; Production keys + custom domain for Production.

---

## Quick test: Clerk + Supabase (My tasks / My documents)

After setting up Clerk ↔ Supabase (Clerk Dashboard → Supabase → Activate; Supabase → Auth → Add provider Clerk + paste domain):

1. **Dev server running:** `npm run dev`
2. **Sign in** (or sign up) and go to **Workspace** (skip or complete onboarding).
3. **Developer tools** (bottom of workspace): you should **not** see the red "Add SUPABASE_URL…" or "No suitable key" errors.
4. **My tasks:** Type a task name → **Add**. The task should appear in the list.
5. **My documents:** Choose a file (or leave empty) → **Upload**. The document should appear in the list.
6. If you see "relation does not exist" for tasks or workspace_documents: run `supabase db push` or apply the migrations in Supabase SQL editor.

---

## 4.5 — Security verification

- [ ] **Data isolation:** Log in as User A → create items (e.g. “My tasks” on workspace, or **upload a document** in “My documents”). Log out. Log in as User B → confirm User B does **not** see User A’s data (no tasks, no documents from User A).
- [ ] **Secrets:** Confirm no real keys in committed files; `.env.local` is in `.gitignore`. If you ever committed a key, rotate it and remove from history.

---

## 4.6 — Domain and Clerk Production

- [ ] **Domain:** [vercel.com/domains](https://vercel.com/domains) — purchase or link domain. Vercel project → Settings → Domains → Add → your domain → Production. Wait 2–5 min; https://yourdomain.com loads with SSL.
- [ ] **Clerk Production:** Dashboard → Production env → copy `pk_live_...`, `sk_live_...`. Domains: add `https://yourdomain.com` (do **not** add `.vercel.app` here). Sessions → Customize session token: `{"metadata": "{{user.public_metadata}}"}` → Save.

---

## 4.6 — Vercel environment variables

**Vercel project → Settings → Environment Variables.**

| Variable | Production | Preview / Development |
|----------|------------|------------------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_...` | `pk_test_...` |
| `CLERK_SECRET_KEY` | `sk_live_...` | `sk_test_...` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` | `/sign-up` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/workspace` | `/workspace` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/onboarding` | `/onboarding` |
| `SUPABASE_URL` | same | same |
| `SUPABASE_SERVICE_ROLE_KEY` | same | same |
| `SUPABASE_ANON_KEY` | same | same |

- [ ] Add each; Clerk keys differ by environment as above. Secret keys show as “Encrypted”.

---

## 4.6 — Pre-production checklist

- [ ] Auth works locally (signup, login, logout, onboarding).
- [ ] Data isolation done (§4.5).
- [ ] Clerk: custom domain + preview (`*.vercel.app`) + localhost allowed; redirect URLs updated.
- [ ] Vercel env set (§ above).
- [ ] RLS migration applied if using “My tasks”: run `supabase db push` or apply `supabase/migrations/20260205120000_clerk_tasks_rls.sql` in Supabase.

---

## 4.6 — Test preview deployment

- [ ] Vercel → deployment for branch **auth-flow** → copy preview URL.
- [ ] Signup → onboarding → `/workspace`; create data (e.g. “My tasks”); log out, log in → skip onboarding, data still there.
- [ ] Incognito → `/workspace` → redirect to sign-in → sign in → land on `/workspace`.
- [ ] Mobile (or DevTools): signup/login.
- [ ] Error states: invalid email, weak password, wrong password show messages.

---

## 4.6 — PR and merge

- [ ] GitHub → Compare & pull request: base **main**, compare **auth-flow**. Title: `feat(auth): implement authentication with Clerk and Supabase`. Description: auth summary, preview URL, link to PRD. Confirm no `.env.local` or secrets in Files changed.
- [ ] Pre-merge: preview tested, data isolation verified, mobile ok, no console errors, env and Clerk domains set, no sensitive data committed.
- [ ] Merge **auth-flow** → **main**. Optionally delete remote `auth-flow` after merge.

---

## 4.6 — Verify production

- [ ] Vercel → latest **main** deployment → “Ready”. Open production domain → sign up (real test account) → onboarding → create data → log out, log in → data persists. Check Clerk/Supabase dashboards for errors.

---

## 4.6 — Cleanup and PRD

- [ ] Local: `git checkout main && git pull origin main && git branch -d auth-flow`.
- [ ] **PRD:** Open `src/docs/auth-flow/auth-flow-prd.md`. Status → “Shipped to Production”; add production URL and ship date; mark stages 1–7 complete.

---

## Auth — loose ends (optional)

- [ ] **Clerk + Supabase (for RLS):** Clerk Dashboard → Integrations → Supabase → Activate. Supabase Dashboard → Authentication → Add provider → Clerk → paste Clerk domain. Only needed if you use “My tasks” or other RLS tables.
- [ ] **RLS “My tasks”:** If you use the Supabase “My tasks” card, apply migration `20260205120000_clerk_tasks_rls.sql` (see Pre-production checklist).
- [ ] **Onboarding loop:** We added a 300ms delay after JWT refresh; if you still see redirect loops, revisit (PRD known issues).
- [ ] **Linear:** If you use Linear, update sprint/board when auth is shipped (PRD Stage 7).
- [ ] **Google sign-up:** Enable "Sign in with Google" in Clerk. Clerk Dashboard → Social connections → Google (use custom credentials) → copy redirect URI → Google Cloud Console → OAuth client → add that exact redirect URI → paste Client ID and Secret back into Clerk. See `src/docs/google-sign-in-setup.md`. Fix `redirect_uri_mismatch` by ensuring the URI in Google matches Clerk's character-for-character (no trailing slash unless Clerk shows one).
- [ ] **Implement Linear:** Set up Linear (workspace, team, project), connect to GitHub if desired, and create issues for open loops from this doc so tasks are tracked in Linear. Optionally link commits with issue IDs (e.g. `Fixes A-XX`). See `GIT-WORKFLOW.md` and `src/docs/agent-whats-next.md`.

---

## 5.1 — User Feedback (feedback modal)

**Done by agent:** Branch `user-feedback`; `src/components/feedback-modal.tsx` (Dialog, react-hook-form + zod, success + auto-close); `src/lib/schemas/feedback.ts` (includes structured analysis types); layout has provider + “Give Feedback” in header; `react-hook-form`, `@hookform/resolvers` installed.

- [ ] **Test feedback modal:** Open app → click “Give Feedback” → modal opens. Submit empty → validation blocks. Fill description, submit → check browser console for `[Feedback] { description: "..." }`. Success message appears, modal closes after 2s.
- [ ] **Optional:** Move “Give Feedback” to a footer if you add one (use `<FeedbackModalTrigger />` there; provider stays in layout).

---

## 5.2 — n8n Workflow Setup (AI Agents)

**Purpose:** Set up n8n workflow automation with AI analysis for feedback processing. See lesson plan and `src/docs/n8n-setup.md`.

### 5.2.1 — n8n Account & Basic Workflow

- [ ] **Create n8n account:** Go to [n8n.io](https://n8n.io), sign up, choose Cloud option, complete onboarding.
- [ ] **Create first workflow:** Add Chat Trigger node → Add Gmail node → Configure Gmail (your email, subject "New Feedback Received", include chat message in body).
- [ ] **Test basic workflow:** Use Test button, send example feedback (negative/positive examples from lesson), verify email received.

### 5.2.2 — Add AI Tools Agent

- [ ] **Add AI Agent node:** Insert between Chat Trigger and Gmail. Select "Tools Agent" type.
- [ ] **Connect chat input:** Reference chat input in AI Agent prompt (e.g. `{{ $json.chatInput }}`).
- [ ] **Configure system message:** Add basic system message: "You are a feedback analysis assistant. Analyze user feedback and provide a brief summary of the sentiment and type of feedback."

### 5.2.3 — Set Up OpenRouter

- [ ] **Create OpenRouter account:** Go to [OpenRouter.ai](https://OpenRouter.ai), sign up (free), create API key, save securely.
- [ ] **Add OpenRouter credentials to n8n:** n8n → Credentials → Create new → Search "OpenRouter" → Paste API key → Save.
- [ ] **Connect OpenRouter to AI Agent:** AI Agent node → Model section → Add Model → Select OpenRouter Chat Model → Choose credentials → Select free model (e.g. `meta-llama/llama-3.2-3b-instruct:free`).
- [ ] **Test AI Agent:** Test workflow with feedback example, verify AI analysis appears in email.

### 5.2.4 — Structured Output Parsing

- [ ] **Update AI Agent system message:** Replace with strict JSON output instructions (see `src/docs/n8n-setup.md` for full system message). Must return: `{ sentiment, category, priority, summary, actionable }`.
- [ ] **Add Structured Output Parser:** After AI Agent → Add node → Search "Structured Output Parser" (LangChain) → Define JSON schema matching feedback analysis structure.
- [ ] **Add Auto-fixing Output Parser:** After Structured Parser → Add "Auto-fixing Output Parser" → Set base parser → Configure retry LLM (OpenRouter credentials, same or different model, max retries 1-2).
- [ ] **Update Gmail node:** Set email type to HTML, update subject to `Feedback Analysis: {{$json.sentiment}} {{$json.priority}}`, update body with HTML table showing all structured fields (see lesson plan section 6.5 for HTML template).

### 5.2.5 — Test with Multiple Feedback Types

- [ ] **Test positive feedback:** "Just wanted to say the new onboarding flow is fantastic!..." → Verify sentiment: positive, priority: low.
- [ ] **Test bug report (negative):** "I've been using the dashboard for a week now..." → Verify sentiment: negative, category: bug, priority: high.
- [ ] **Test feature request (neutral):** "It would be nice to have keyboard shortcuts..." → Verify sentiment: neutral, category: feature_request, priority: medium.
- [ ] **Verify email formatting:** Check that HTML table renders correctly, all fields display, actionable shows ✅/❌.

---

## 5.3 — Mobile Responsive Testing

**Purpose:** Test and fix responsive design issues across different screen sizes. See `src/docs/mobile-responsive-testing.md` for detailed guide.

### 5.3.1 — Setup Testing Tools

- [ ] **Install Responsive Viewer:** Chrome Web Store → Search "Responsive Viewer" → Add to Chrome → Pin to toolbar.
- [ ] **Configure test devices:** iPhone (390px), iPad (820px), MacBook (1440px) — covers Base, md:, and xl: breakpoints.

### 5.3.2 — Test Public Pages

- [ ] **Homepage (`/`):** Hero section, cards, early access form — verify no horizontal scrolling, buttons accessible, text readable.
- [ ] **Sign In (`/sign-in`):** Clerk form — verify inputs fit, submit button visible, keyboard doesn't cover button.
- [ ] **Sign Up (`/sign-up`):** Clerk form — verify inputs fit, submit button visible, keyboard doesn't cover button.

### 5.3.3 — Test Authenticated Pages

- [ ] **Onboarding (`/onboarding`):** Multi-step flow — verify steps display correctly, forms usable, navigation buttons accessible.
- [ ] **Workspace (`/workspace`):** Tabs, cards, task lists, forms — verify tabs don't overflow, cards stack on mobile, forms fit properly.

### 5.3.4 — Test Shared Components

- [ ] **Header navigation:** Sign In/Sign Up buttons (signed out), User button + Feedback trigger + Language toggle (signed in) — verify no wrapping issues, all buttons accessible.
- [ ] **Feedback modal:** Open from header on each device — verify modal fits on screen, form usable, submit button accessible, no cut-off.

### 5.3.5 — Document Issues

- [ ] **Create issue list:** For each device (iPhone, iPad, MacBook), document specific problems with page/component and what should happen instead.
- [ ] **Take screenshots (optional):** Before/after screenshots helpful for reference.

### 5.3.6 — Fix Issues with Cursor AI

- [ ] **Use prompt template:** See `src/docs/mobile-responsive-testing.md` section 6 for effective prompting guide.
- [ ] **Fix iteratively:** Fix a few issues at a time, test after each batch, provide clear feedback to AI.
- [ ] **Verify fixes:** Test all devices after fixes, mark issues as resolved or note if more work needed.

### 5.3.7 — Final Verification

- [ ] **No horizontal scrolling** on any device.
- [ ] **Buttons minimum 44x44px** touch targets on mobile.
- [ ] **Text readable** without zooming (minimum 16px body text).
- [ ] **Forms fit properly** on all screen sizes.
- [ ] **Modals fit** without cut-off.
- [ ] **Navigation accessible** on all devices.

---

## 5.4 — Webhook Integration

**Purpose:** Connect feedback form to n8n webhook and receive processed feedback back. See `src/docs/user-feedback/user-feedback-prd.md` for complete PRD.

### 5.4.1 — Update n8n Workflow

- [ ] **Replace Chat Trigger with Webhook Trigger:** In n8n workflow from lesson 5.2, delete Chat Trigger → Add Webhook Trigger node → Configure POST method → Copy Production URL.
- [ ] **Update AI Agent:** Change input prompt from `{{ $json.chatInput }}` to `{{ $json.body.message }}` (webhook payload structure).
- [ ] **Update Gmail node:** Update email body HTML to include webhook fields (firstName, lastName, email, url) — see PRD for template.
- [ ] **Add HTTP Request node:** After Gmail → Add HTTP Request node → Configure POST to app webhook endpoint → Set body with combined payload (original + AI analysis) — use `JSON.stringify()` for strings, not booleans — see PRD for exact structure.
- [ ] **Test updated workflow:** Use n8n "Test workflow" or curl to send test webhook → Verify AI Agent processes → Verify Gmail sends → Verify HTTP Request shows combined payload.

### 5.4.2 — Environment Variables

- [ ] **Add n8n webhook URL:** Copy Production URL from Webhook Trigger node → Add to `.env.local`: `N8N_FEEDBACK_WEBHOOK_URL=https://...`
- [ ] **Add to Vercel:** Vercel → Project Settings → Environment Variables → Add `N8N_FEEDBACK_WEBHOOK_URL` → Apply to Preview and Production.

### 5.4.3 — Create Supabase Feedback Table

- [ ] **Run migration:** Apply `supabase/migrations/20260206000000_feedback_table.sql` → Use `supabase db push` or apply in Supabase dashboard → Verify table created with all columns.
- [ ] **Verify RLS policies:** Check that INSERT policy allows authenticated users → Check that SELECT policy allows users to view their own feedback.

### 5.4.4 — Test Outgoing Webhook (App → n8n)

- [ ] **Restart dev server:** After adding `N8N_FEEDBACK_WEBHOOK_URL` to `.env.local`, restart `npm run dev`.
- [ ] **Submit test feedback:** Open app → Click "Give Feedback" → Enter test message → Submit → Verify success message appears.
- [ ] **Check n8n execution:** n8n dashboard → Executions tab → Verify new execution appears → Click to view received data (userId, firstName, lastName, email, message, browser, timestamp, url).
- [ ] **Check email:** Verify Gmail notification received with original feedback + AI analysis.

### 5.4.5 — Test Incoming Webhook (n8n → App)

- [ ] **Test webhook endpoint locally:** Use curl to send test payload to `http://localhost:3000/api/webhooks/n8n/feedback` → Verify response `{success: true}` → Check Supabase table for inserted row.
- [ ] **Update n8n HTTP Request URL:** Set callback URL to `http://localhost:3000/api/webhooks/n8n/feedback` (for local testing) → Test workflow → Verify data stored in Supabase.

### 5.4.6 — Test End-to-End with Vercel Preview

- [ ] **Commit and push code:** Commit all changes → Push to feature branch → Wait for Vercel preview deployment.
- [ ] **Get preview URL:** Vercel dashboard → Latest deployment → Copy preview URL (e.g., `https://your-app-abc123.vercel.app`).
- [ ] **Update n8n HTTP Request:** Set callback URL to preview URL + `/api/webhooks/n8n/feedback` → Save workflow.
- [ ] **Submit feedback on preview:** Open preview URL → Submit test feedback (bug report, feature request, praise) → Wait for success message.
- [ ] **Verify complete flow:** For each submission:
  - [ ] n8n execution shows webhook received
  - [ ] Email notification received with AI analysis
  - [ ] Vercel logs show incoming webhook callback
  - [ ] Supabase table shows row with all fields populated (sentiment, category, priority, summary, actionable)
- [ ] **Test edge cases:** Very long message (500+ chars), multiple quick submissions, verify all AI fields populated.

---

## 5.5 — Webhook Security

**Purpose:** Secure webhook endpoint with rate limiting and API key verification. See lesson plan for security threats explanation.

### 5.5.1 — Generate Webhook Secret

- [ ] **Generate secret:** Run `openssl rand -hex 32` → Copy the generated secret (64-character hex string).
- [ ] **Add to `.env.local`:** Add `N8N_WEBHOOK_SECRET=your-secret-from-above` → Never commit this to Git.
- [ ] **Add to Vercel:** Vercel → Project Settings → Environment Variables → Add `N8N_WEBHOOK_SECRET` → Apply to Preview and Production.

### 5.5.2 — Configure n8n to Send API Key

- [ ] **Open n8n workflow:** Go to HTTP Request node (webhook callback to your app).
- [ ] **Add header:** In Header Parameters section → Add header:
  - **Name:** `X-API-Key`
  - **Value:** Your secret from step 5.5.1 (paste the actual secret value)
- [ ] **Save workflow:** Ensure "Send Headers" is toggled ON.

### 5.5.3 — Test Rate Limiting

- [ ] **Restart dev server:** After adding `N8N_WEBHOOK_SECRET` to `.env.local`, restart `npm run dev`.
- [ ] **Test rate limit:** Use curl or script to send 15 requests quickly:
  ```bash
  for i in {1..15}; do
    curl -X POST http://localhost:3000/api/webhooks/n8n/feedback \
      -H "Content-Type: application/json" \
      -H "X-API-Key: your-secret" \
      -d '{"test": true}' &
  done
  wait
  ```
- [ ] **Verify behavior:** First 10 requests should succeed (200) → Requests 11-15 should be blocked (429) → Check logs for rate limit messages.
- [ ] **Test reset:** Wait 60 seconds → Send another request → Should succeed (rate limit reset).

### 5.5.4 — Test API Key Verification

- [ ] **Test valid API key:** Send request with correct `X-API-Key` header → Should succeed (200).
- [ ] **Test invalid API key:** Send request with wrong `X-API-Key` header → Should fail (401 Unauthorized).
- [ ] **Test missing API key:** Send request without `X-API-Key` header → Should fail (401 Unauthorized).
- [ ] **Check logs:** Verify all attempts are logged with status (SUCCESS, BLOCKED, ERROR).

### 5.5.5 — Verify Logging

- [ ] **Check local logs:** Terminal where `npm run dev` is running → Look for `[WEBHOOK]` log entries → Verify format: `[WEBHOOK] timestamp | IP | status | reason`.
- [ ] **Test on Vercel preview:** Deploy to preview → Submit feedback → Check Vercel Logs tab → Filter by "webhook" → Verify logs appear.
- [ ] **Monitor for suspicious activity:** Watch for patterns:
  - Many rate limit blocks from same IP (possible attack)
  - Many invalid API key attempts (spoofing attempt)
  - Unusual request sizes (payload attack)
  - Spikes in requests (DDoS attempt)

**Next (5.6):** Debug Production — Learn to debug production issues using Vercel logs and n8n execution history.

---

## Future Features — Planning

### Document & Form Generation Tool (Founder Request)

**Status:** Planning — Awaiting example data structure  
**PRD:** `src/docs/letter-generation/letter-generation-prd.md`  
**Legacy PRD:** `src/docs/insurance-cancellation/insurance-cancellation-prd.md` (superseded)

**Overview:** Comprehensive document, letter, and form generation tool for family office / full-service operations. Drafts formal documents on behalf of clients (letters, documents, legal forms like Vollmacht), manages template wording libraries, sends PDFs to clients for signature via WhatsApp or email, and manages complete workflow from draft to signed delivery.

**Current Stage:** Stage 0 — Data Structure Planning

- [ ] **Review example data structure:** When founder provides example data/table headers, review and refine database schema
- [ ] **Finalize requirements:** Confirm document types, Vollmacht types, required fields, legal requirements, template wording structure
- [ ] **Create implementation plan:** Break down into development stages (see PRD)

**Key Features:**
- Document generation (letters, formal documents, legal forms)
- Form generation (Vollmacht - specific and general, other legal forms)
- Template wording library system with versioning
- AI-powered drafting with OpenAI + template wording
- Internal approval workflow
- PDF generation (DIN-compliant, fillable fields for forms)
- Client delivery via WhatsApp or Email
- Client signature collection (digital or physical)
- Final delivery to recipients (optional)
- Complete audit trail

**Next Steps (after data review):**
- Stage 1: Database & Core Schemas (migrations for `documents` and `document_templates` tables, Zod schemas, RLS)
- Stage 2: Template Management System (wording library, versioning, CRUD)
- Stage 3: Document Creation & Drafting (form, OpenAI, template integration)
- Stage 4: Approval Workflow (review, edit, approve)
- Stage 5: PDF Generation (DIN-compliant formatting, fillable fields)
- Stage 6: Client Delivery (WhatsApp & Email integration)
- Stage 7: Signature Collection (digital/physical)
- Stage 8: Final Delivery & Management (recipient delivery, UI)

**Integration Points:**
- Uses existing OpenAI integration for letter drafting
- Leverages existing document generation system (DIN-compliant)
- Follows existing approval workflow patterns
- Links to assignment/client system
- Stores in Supabase with RLS policies
