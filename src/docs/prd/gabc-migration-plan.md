# GABC — Migration Plan + Time Estimate

**Preview / board approval:** `gabc.logans.tools`  
**Current canonical site:** `https://gabc.eu/`

## Summary

We ship in **phases** so the board can approve the direction early, while we keep the existing site stable until cutover.

## Phase 0 — Discovery (3–5 days)

- Content inventory: pages, events, membership tiers, patrons, testimonials, chapters.
- Confirm languages (EN only vs EN+DE).
- Confirm “system of record” for events/memberships today (and what we are *not* replacing yet).
- Confirm legal baseline (Impressum/Datenschutz/cookies/consent, photo rights, logo usage).

**Deliverables:** final IA, wireframes, content list, acceptance criteria.

## Phase 1 — Board-approval marketing site (1.5–3 weeks)

- Next.js site skeleton + design system alignment
- Public pages: Home, About, Events (list/detail), Membership, Contact, Legal
- SEO baseline + sitemap/robots + share previews
- PRD page with suggestion box emailing `logan.williams@gabc.eu`
- Deploy to `gabc.logans.tools`

**Outcome:** Board can review and approve the concept using a real working site.

## Phase 2 — Content operations + CMS (1–2 weeks)

Choose a content model:

- **Option A: MDX in git** (fastest; editors need git/PR help)
- **Option B: Headless CMS** (best for non-technical editors; setup time + governance)
- **Option C: DB-backed admin** (most custom; slowest; only if strong product need)

**Deliverables:** editor workflow, preview workflow, content governance.

## Phase 3 — Member section MVP (3–6 weeks)

### Auth + roles

- Login for “friends” via OAuth (Google/Microsoft) if needed.
- Members with tiers: individual/family/corporate (final list as per canonical site).
- Admin roles: editor vs treasurer/admin.

### Focus areas (member preferences)

- Define a controlled taxonomy of **focus areas** (industry/themes/chapter/format as needed).
- Member profile stores focus area selections.
- Events and posts can be tagged with focus areas.
- Notifications/invitations are filtered by member preferences, with a bypass for mandatory council-wide announcements.

### Commerce model (foundation)

One unified order model supports:

- **membership subscriptions** (Stripe recurring),
- **tickets** (free + paid),
- **documents/whitepapers** (free + paid).

### Stripe recurring membership (required)

- Stripe Customer + Subscription per member/org
- Webhooks for subscription status and entitlements
- Invoices/receipts email behavior (Stripe-hosted or custom)

### Tickets + documents

- Free tickets: registration with confirmation email
- Paid tickets: Stripe Checkout (or embedded) + entitlement grant
- Paid documents: purchase → gated download access

**Deliverables:** member dashboard, purchases, privileged content gating, admin view for inventory.

## Phase 4 — WERO payments (2–4 weeks, feasibility-dependent)

**Goal:** allow WERO where possible with minimal extra complexity.

### Best case

- Stripe supports WERO for the target flows/regions, so we expose it as an additional payment method via Stripe.

### If Stripe does not support WERO

- Integrate a separate PSP that supports WERO.
- Map WERO payment confirmations into the same internal “order paid” event as Stripe.

**Deliverables:** payment method availability logic by country, reconciliation approach, support runbook.

## Phase 5 — Cutover to `gabc.eu` (3–7 days)

- Domain + redirects + canonical alignment
- Update internal links and any legacy URLs
- Monitoring + rollback plan

---

## Estimated timeline (total)

This is intentionally conservative; board feedback and content readiness dominate timeline.

- **Phase 0:** 0.5–1 week
- **Phase 1:** 1.5–3 weeks
- **Phase 2:** 1–2 weeks (optional but recommended)
- **Phase 3:** 3–6 weeks
- **Phase 4:** 2–4 weeks (depends on WERO API/Stripe support)
- **Phase 5:** 0.5–1 week

**Total range:** ~**6–17 weeks**, depending on how much member commerce we include before launch and whether WERO is straightforward.

## Risks

- Legal/consent requirements on analytics and forms.
- Content rights (logos/photos/testimonials).
- Payments compliance and webhook security.
- WERO feasibility; could be blocked by provider constraints.

