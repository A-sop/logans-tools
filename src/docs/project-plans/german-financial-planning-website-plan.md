# German Financial Planning Website — Project Plan

**Goal:** MVP of germanfinancialplanning.de — published, authority-style like [pirateskills.com](https://pirateskills.com/), with login, blog, and eventual planner app based on [Builder Codex](https://pirateskills.com/build/codex).

**Current site:** [germanfinancialplanning.de](https://www.germanfinancialplanning.de/)  
**Target feel:** [pirateskills.com](https://pirateskills.com/) — professional, founder-led, clear value.  
**Data source:** [Allfinanz Logan Williams](https://www.allfinanz.ag/logan.williams/index.html) — testimonials, services, contact, credentials.  
**Content inspiration:** [Captain's Insights](https://pirateskills.com/insights) — regular authority blog posts.  
**Planner app:** Built using [Builder Codex](https://pirateskills.com/build/codex) lesson plans (in `src/docs/builder-codex/`).

---

## Inspiration & Positioning

### Urban Finance (Sebastian Urban) — Design & Structure

**URL:** https://www.urbanfinance.de/

**Use for:** Dark theme, hero layout, service structure, aspirational copy, transparent value props. Closest visual/reference in the German expat financial space.

**Important difference:** Sebastian Urban is an **Honorarberater** (fee-only advisor). Clients pay directly for advice (e.g. urPlan €1,995, urInvest €995). No commission from products. He is *provisionsfrei gegen Honorar*.

### Logan / GFP — Provision-Based Model

**URL:** https://www.allfinanz.ag/logan.williams/index.html

Logan works with **Allfinanz / Deutsche Vermögensberatung (DVAG)**. Model: no direct fee for advice; commission when clients sign contracts (insurance, investment products). Commission is built into product prices. Per Allfinanz FAQ: *"Es entstehen für Sie im Rahmen eines Finanzcoachings keine direkten Kosten. Sollten Sie Verträge abschließen, wird eine Provision fällig. Diese bezahlen Sie als Kunde nicht direkt."*

**For the site:** Borrow Urban Finance’s dark aesthetic, structure, and clarity — but position GFP’s offering honestly (provision-based, not Honorar). Messaging and CTAs will differ (no "provisionsfrei" claim; focus on holistic coaching, ongoing support, one point of contact).

---

## MVP Scope

### Phase 1 — Marketing Site (Today’s MVP)

- **Homepage** — hero, value prop, main sections (Why Financial Planning, Money Tips, Work With Me).
- **Blog / Insights** — authority posts (retirement, insurance, expat finances). List + detail pages.
- **Login page** — Clerk sign-in/sign-up (no full app behind it yet).
- **Work With Me** — services, contact, book a consultation.
- **Testimonials** — from Allfinanz page; "Don't take my word for it."
- **Footer** — Legal, Impressum, Datenschutz, Contact.

### Phase 2 — Behind Login (Later)

- **Previous blog posts** — gated archive or members-only content.
- **Planner app** — workspace, assignments, documents (Builder Codex flow: auth, Supabase, RLS, etc.).

---

## How to Create This Project From Current Codebase

### 1. Clone and Adapt (Don’t Strip Everything)

```powershell
# From c:\Dev\
git clone <my-app-repo> german-financial-planning
cd german-financial-planning
```

This project will **reuse** auth, database, and eventual planner logic. Strip only CM-specific branding and features.

### 2. Remove CM-Specific, Keep Auth + Structure

**Remove:**

- `src/docs/workspace-prd.md`, `src/docs/letter-generation/`, `src/docs/document-intake-*`
- CM-specific copy, "Consulting & More" branding
- `src/app/pricing/` (unless you add paid tiers later)
- `src/app/changelog/` (optional — you can keep for product updates)
- Linear MCP / CM issue references in rules

**Keep:**

- Auth flow (Clerk): sign-in, sign-up, onboarding — **simplify onboarding** to 1 screen or skip for MVP.
- Supabase setup — you'll need it for blog posts (optional: start with MDX) and planner later.
- `src/docs/builder-codex/` — full lesson plans for building the planner app.
- `src/docs/automation-for-next-project.md`
- `.cursor/rules/` — tech-stack, design-system, security, clerk-integration, database-migrations (simplify)
- Scripts: setup-env.js, check-env-keys.js

### 3. Rebrand

- App name: "German Financial Planning" / GFP
- Concept: Financial planning for expats in Germany (Logan Williams, Allfinanz/DVAG).
- Replace `concept.md` and PRDs with GFP-specific docs.

### 4. New Integrations (Phase 1)

| Integration | Purpose |
|-------------|---------|
| **Clerk** | New Application — login/signup only for MVP |
| **Supabase** | New Project — blog posts table, later planner tables |
| **Vercel** | New Project — deploy |

Skip for MVP: Stripe, n8n (add when you add feedback form or automation).

### 5. Content from Allfinanz

Scrape or manually copy into your content layer:

- Testimonials (Emma N., Wolfgang V., Steven Marks, etc.)
- Services: 5-step financial coaching, individual concept, one point of contact
- Contact: Zülpicher Wall 16, Köln; phone, email
- Impressum / Datenschutz structure (you'll need proper legal text)

---

## Prompt for AI (Copy Into New Chat)

```
Create a professional financial planning website for German Financial Planning (germanfinancialplanning.de) with this brief:

**Audience:** Expats in Germany needing clarity on health insurance, retirement, and financial planning. Logan Williams (Allfinanz/DVAG) is the advisor.

**Design reference:** https://pirateskills.com/ — clean, founder-led, professional. Authority without corporate stuffiness.

**Data source:** https://www.allfinanz.ag/logan.williams/index.html — testimonials, services (5-step process), contact (Zülpicher Wall 16, Köln), credentials. Use this for real copy and structure.

**Content inspiration:** https://pirateskills.com/insights — regular authority blog posts on retirement, insurance, expat finances, "Life in Germany" money topics.

**Sections to build:**
1. Homepage — hero ("Financial freedom in five steps"), value prop, main sections, testimonials carousel/section.
2. Blog / Insights — list posts (date, title, excerpt); detail page. Content from MDX or Supabase. Authority tone.
3. Login — Clerk sign-in and sign-up pages. Redirect after login to /dashboard or /planner (placeholder for now).
4. Work With Me — 5-step process, what to expect, CTA to book/contact.
5. Money Tips — overview of categories (Provident, Finances, Corporate, Careers).
6. Footer — Impressum, Datenschutz, Contact, social.

**Tech:** Next.js 16, App Router, Tailwind 4, shadcn/ui, Clerk (auth), Supabase (blog + future planner). Use existing auth flow patterns but simplify onboarding to 1 screen or skip.

**Tone:** Professional, warm, "competent help" — like Allfinanz page but with pirateskills.com clarity.

**Future:** Planner app (workspace, assignments, documents) will follow Builder Codex — auth, Supabase RLS, etc. For now, login just lands on a simple dashboard or "Coming soon" for planner.

Start with: homepage + blog list/detail + Clerk auth pages. Use real testimonials from Allfinanz. Deployable to Vercel.
```

---

## Planner App (Phase 2 — Builder Codex)

When ready to build the planner:

1. Use `src/docs/builder-codex/` lesson plans (Levels 3–6).
2. Workspace = assignments, tasks, documents (similar to current my-app).
3. New Supabase project, new Clerk app — silo per automation-for-next-project.md.
4. RLS, feature gating, payments only if/when you monetize.

---

## Deployment

1. **GitHub** — New repo `german-financial-planning`.
2. **Vercel** — New project, connect repo.
3. **Clerk** — New Application; add domain when ready.
4. **Supabase** — New Project; add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` to Vercel.
5. **Custom domain** — germanfinancialplanning.de → Vercel.

---

## .env.example (Phase 1)

```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/onboarding

# Supabase (blog, later planner)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=
```

---

## Cleanup Reminder

**After this project is live:** Return to the source project (`my-app`) and remove any GFP-specific data, content, or migrations you may have added. Keep `my-app` as the CM / Builder Codex SaaS reference. Consider archiving or moving `src/docs/builder-codex/` to a shared location if you'll reuse across projects.
