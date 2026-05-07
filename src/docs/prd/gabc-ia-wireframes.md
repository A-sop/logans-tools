# GABC — IA + Wireframes (Low-fi, Draft)

## IA (Phase 1 public)

**Top nav**

- Home (`/`)
- Events (`/events`)
- Membership (`/membership`)
- About (`/about`)
- Contact (`/contact`)

**Footer**

- Legal: Impressum (`/legal/impressum`), Datenschutz (`/legal/privacy`), Cookies (`/legal/cookies`)
- Chapters: Frankfurt, Berlin, Munich (anchor links to `/about#chapters`)
- Social (if applicable)

**Board preview utilities (non-canonical)**

- Board hub (`/gabc`) — PRD + migration + preview checklist + suggestions

## URL scheme (Phase 2+ member area)

- Member login (`/member`)
- Member dashboard (`/member/dashboard`)
- Member content library (`/member/library`)
- Member tickets (`/member/tickets`)
- Member settings (focus areas) (`/member/settings`)

## Wireframes

### 1) Home (`/`)

**Hero**

- H1: “Bringing Germans and Australians together around business”
- Subhead: “25+ years connecting Germany & Australia”
- Primary CTA (decide): “View upcoming events” or “Become a member”
- Secondary CTA: the other one

**What we offer (3 cards)**

- Events
- Membership
- Council / About

**Patrons (proof)**

- Patron cards (name + title)

**Benefits (3 columns)**

- Connections
- Communication
- Member services

**Testimonials**

- 2–4 quotes with attribution

**Chapters**

- Frankfurt / Berlin / Munich summary + HQ address

**Corporate members**

- Logo strip/grid (if approved)

### 2) Events (`/events`)

**Header**

- H1: Events
- Filter chips:
  - Chapter (Frankfurt/Berlin/Munich)
  - Format (online/in-person)
  - Date (upcoming/past)
  - Focus areas (Phase 2+)

**Event list**

- Event card: title, date/time, chapter, format, short excerpt
- CTA: “View details”

### 3) Event detail (`/events/[slug]`)

- Title + date/time (timezone explicit)
- Location / online link (if public)
- Agenda/description
- Speakers (optional)
- CTA:
  - “Register” (external link or internal tickets in Phase 2+)
- Related events (optional)

### 4) Membership (`/membership`)

- H1: Membership
- Value statement + “who it’s for”
- Tier comparison (table/cards)
  - Individual / Family / Corporate (+ others as per canonical)
- Benefits summary
- Application CTA:
  - Phase 1: link to existing application form
  - Phase 2: in-app apply + Stripe recurring

### 5) About (`/about`)

- Mission + nonprofit statement
- Board (names/roles)
- Chapters
- History / “25+ years” story
- Partners/patrons

### 6) Contact (`/contact`)

- Contact form (spam-protected)
- HQ address
- Chapter contacts (if distinct)

### 7) Legal

- `/legal/impressum`
- `/legal/privacy`
- `/legal/cookies`

