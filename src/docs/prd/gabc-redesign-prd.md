# PRD — GABC Website Redo (Board-Approval Preview)

**Preview domain (board approval):** `gabc.logans.tools`  
**Canonical current site:** `https://gabc.eu/`

## Direct answer (what we’re building)

We’re rebuilding the German Australian Business Council’s website into a **modern, fast, accessible** experience that makes it easy to:

- discover and register for events,
- understand membership tiers and apply,
- trust the council (patrons, board, corporate members),
- and (later) let members log in to access privileged content and purchase tickets/documents.

## Goals

- **Clarity:** New visitors understand who GABC is, why it matters, and what to do next in under 60 seconds.
- **Conversion:** More event registrations and membership applications, fewer “how do I…” emails.
- **Trust:** Patrons/partners and governance presented professionally; legal and nonprofit transparency is easy to find.
- **Maintainability:** GABC can update events/news/content without developer involvement (within guardrails).

## Non-goals (Phase 1)

- Replacing an Association Management System (AMS).
- Building a fully custom CRM.
- Complex member workflows (invoicing, renewals, multi-admin org management).

## Users and roles

### Public audience (“viewers”)

- **Prospective member/visitor:** no login, can browse public pages and public events.
- **Friend:** OAuth login (Google/Microsoft). Still a “viewer” but can leave identified suggestions, and may receive “friend-only” previews if enabled.

### Members

Membership tiers should reflect the canonical site:

- **Individual**
- **Family**
- **Corporate** (and/or additional org tiers as per current membership levels)

**Privileged access (members):**

- member-only content library (whitepapers, documents),
- member-only event tickets,
- discounted pricing (optional),
- member-only announcements/newsletters (optional).

**Member preferences (focus areas):**

Members can express interest in one or more **focus areas** (to be defined by GABC, e.g. industries, themes, chapters, formats). These preferences control:

- which event invitations they receive,
- and which updates they receive about relevant new posts/updates.

**Rules:**

- Default = “all focus areas” until a member opts into a narrower set.
- Always allow **mandatory council-wide announcements** to bypass preferences.
- Members can update preferences at any time in their profile.
  - Corporate accounts: optionally allow org admins to set defaults for their org.

### Admins

- **Editor:** manage events, documents, news; no billing control
- **Treasurer/Admin:** manage membership billing settings (Stripe), refunds, ticket inventory

## Core pages (Phase 1 — board approval)

- **Home** — value prop, proof (patrons, testimonials), quick path to events + membership.
- **Events** — list + detail pages, clear registration CTA, location/timezone clarity.
- **Membership** — tiers + benefits + application.
- **About** — council mission, chapters, board, history, nonprofit framing.
- **Contact** — general inquiries, chapter contacts.
- **Legal** — Impressum, Datenschutz, cookies/consent.
- **PRD page** — viewable PRD with suggestion form (this doc + comment box).

## Member section (Phase 2)

### Authentication

- **OAuth for friends** (Google/Microsoft).
- **Passwordless email / magic link** or OAuth for members (decision required).
- Role assignment: member tier and admin role.

### Payments and commerce

- **Stripe recurring payments** for membership (monthly/annual).
- **Tickets**: free and paid tickets purchasable in-app.
- **Documents/whitepapers**: free downloads and paid purchases in-app.

### Access control

- Gated content by role: prospective member/visitor, friend, member tier, admin.
- Paid items grant access on successful payment (idempotent, audit log).

## WERO payment system (requirement + feasibility note)

WERO (European wallet/instant payments initiative) is a requirement, but feasibility depends on:

- whether WERO provides a merchant API usable directly by GABC,
- whether Stripe can act as the PSP for WERO (preferred if supported),
- or whether a separate PSP/integration is required.

**Decision rule:** If Stripe supports WERO for the target countries and checkout flows, we implement it through Stripe. Otherwise we plan WERO as a Phase 3 integration behind the same “order” model used for tickets/documents.

## Functional requirements

### Events

- Event list filters: chapter (Frankfurt/Berlin/Munich), format (online/in-person), date.
- Event detail: agenda, speakers, location, registration CTA, refund policy/terms if paid.
- Ticket inventory (Phase 2+).

**Focus area tagging (Phase 2+):**

- Each event can be tagged with one or more focus areas.
- Invitations/notifications can be filtered by those focus areas (member preference match).

### Membership

- Clear tier comparison
- Apply flow (Phase 1 can link to existing application; Phase 2 brings it in-app)

### Suggestions (board approval loop)

- A public page that shows the PRD.
- A comment box for suggestions; suggestions are emailed to `logan.williams@gabc.eu`.

## Success metrics

- Membership applications per month
- Event registrations per event
- Newsletter signups (if used)
- Reduced inbound support emails (“how to join”, “how to register”)
- Lighthouse/CWV + accessibility baseline on key templates
  - Reduced unsubscribes/complaints by sending more relevant invitations via focus areas

## Open decisions

- English-only vs EN+DE (and if DE, full hreflang strategy).
- CMS choice (MDX vs headless CMS vs database-backed admin).
- Payment scope for Phase 2 (tickets + docs first, or membership recurring first).
- WERO integration path (Stripe-supported vs separate PSP).

