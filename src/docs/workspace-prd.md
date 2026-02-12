# Product Requirements Document

## Executive Concierge — Workspace

**Status:** Active PRD – MVP with Roadmap

---

## 1) Product Vision

Build an executive concierge and operational assistant that turns voice instructions, forwarded messages, and documents into structured client assignments, obligations, and executed workflows. The system minimizes human oversight while preserving control by routing sensitive actions to a designated human assistant for approval.

The product functions as a **CRM + task manager + document intelligence system** for modern executives and concierge operators.

---

## 2) Objective

Enable an executive to delegate operational complexity to a system that:

- captures instructions via **voice, messages, and documents**,
- maintains a reliable, structured assignment database,
- drafts communications and prepares documents and forms,
- and uses a **human assistant approval layer** for outbound communication and high-risk updates.

---

## 3) Users & Roles (MVP)

### 1. Executive (Primary User)

- Owns the account and subscription
- Issues instructions (voice, forwarded messages, uploads)
- Oversees assignments and final outcomes
- Can act on behalf of their own clients

### 2. Assistant (Human Approver – Included)

- Added by the Executive (name + email)
- Has access to assignments and tasks
- Reviews and approves:
  - outbound communications
  - sensitive data updates

- Can send communications **on behalf of the Executive or their clients**, within granted permissions

> **Note:** MVP supports **one assistant per account**, included in the base subscription. Expanded team roles are on the roadmap.

---

## 4) Non-Goals (MVP)

- No fully autonomous outbound communication (approval always required)
- No native mobile app (roadmap)
- No unlimited team permissions (1 assistant only)
- No attempt to provide legal advice (process support only)

Billing and subscription logic **is in scope** but may be minimal at MVP launch.

---

## 5) Core Data Objects

### Account

- Subscription
- Users (Executive + Assistant)
- Permissions

### Assignment

- Client (person or business)
- Service type (relocation, business setup, property purchase, business acquisition, etc.)
- Status/stage
- Linked tasks, documents, messages
- Approval rules

> **Nomenclature:** An **assignment** is a piece of work for a client—whether an individual (relocation, residence permit) or a business (business setup, acquisition). We use "assignment" (EN) / "Auftrag" (DE) to reflect work with humans and businesses across varied engagements.

### Contact

- Person or organization
- Role (client, authority, vendor)
- Communication permissions

### Task / Obligation

- Owner
- Due date
- Priority
- Status
- Linked Assignment

### Document

- Original file
- Extracted text
- Structured fields (candidate + approved)
- Normalized file name
- Audit history

### Message

- Inbound / outbound
- Source (email, forwarded message, voice transcript)
- Sender / recipient
- Approval status

### Voice Instruction

- Audio
- Transcript
- Interpreted intent
- Confidence score
- Approval requirement

---

## 6) Scope (MVP)

### A) Multi-Channel Input

- Email forwarding / CC
- Voice instructions (speech-to-text)
- Forwarded messages from other platforms (e.g. WhatsApp via forwarding)
- Optional Slack intake (not required, not core)

### B) Document Ingestion & Intelligence

Output language matches document language (see §J).

- Supported formats:
  - PDF
  - DOCX
  - XLS/XLSX
  - Common image formats

- OCR for scanned documents and images
- Text extraction for digital files
- Structured data extraction with confidence scoring

### C) Approval-Gated Database Updates

- All extracted data shown as **candidate updates**
- Assistant or Executive approves before write
- High-risk fields always require approval
- Full audit trail

### D) Document Normalization & Retrieval

- Automatic human-readable renaming:
  - Assignment
  - Document type
  - Date
  - Identifier

- Searchable and attachable later
- Original files preserved

### E) Assignment Workspace (CRM)

- Single source of truth per assignment:
  - Contacts
  - Documents
  - Fields
  - Tasks
  - Timeline

- Role-based visibility (Executive vs Assistant)
- Accessible UI (keyboard, screen reader)

### F) Workspace & Task Management

- Tasks created from:
  - Voice
  - Messages
  - Documents

- Global and assignment-specific task views
- Waiting-on tracking

### G) Communications & Letters (Approval Required)

Drafted content follows the **input language** (see §J) — e.g. German input → German draft, formal Sie tone.

#### Email

- Drafted by system
- Approved by Assistant or Executive
- Sent on behalf of:
  - Executive
  - Executive's client (where permitted)

#### Letters (DIN-Compliant)

- Generate formal letters:
  - With or without letterhead
  - DIN-standard layout
  - Sender, receiver, date, subject
  - Placeholder for logo

- Export as PDF or DOCX
- Approval required before sending or exporting

### H) Form Assistance

- Form-ready data packets
- Missing-field detection
- Approval-gated requests for missing information

### I) Accessibility

- Keyboard navigation
- Screen reader compatibility
- Adequate contrast
- Text-to-speech for summaries and drafts

### J) Internationalization (i18n)

#### Nomenclature (localised)

| Concept        | English    | German         |
| -------------- | ---------- | -------------- |
| Main workspace | Workspace  | Arbeitsbereich |
| Client matter  | Assignment | Auftrag        |
| Task list view | Tasks      | Aufgaben       |

- **Required:** English and German UI
- **Optional (roadmap):** Persian, Portuguese
- Language toggle in the UI (user-selectable)
- All user-facing strings localized
- Locale persistence (e.g. localStorage)

#### Language Policy — Input-Driven Output

- **Primary language = input language.** The system's output language follows the language of the source material.
- If a document, message, or voice instruction is received in **German**, all related outputs (extractions, drafts, summaries, communications) are produced in **German**.
- If the input is in **English**, outputs are in **English**.
- **Tone:** Charming but formal. In German, always use the **Sie form** (formal "you"), not Du.

---

## 7) Permissions Model (MVP)

| Action                 | Executive | Assistant         |
| ---------------------- | --------- | ----------------- |
| View assignments       | Yes       | Assigned only     |
| Upload documents       | Yes       | Yes               |
| Edit candidate updates | Yes       | Yes               |
| Approve updates        | Yes       | Yes               |
| Draft communications   | Yes       | Yes               |
| Send communications    | Yes       | Yes (if approved) |
| Manage users           | Yes       | No                |

---

## 8) Automation & Control Policy

- **Always approval-required:**
  - Outbound communications
  - Identity/legal data updates

- Optional future setting:
  - Auto-apply low-risk, high-confidence updates

- All actions logged and auditable

---

## 9) Success Metrics (Initial)

- Time from input → structured assignment/task
- % of documents with approved extracted fields
- Reduction in manual task creation
- Approval turnaround time
- On-time task completion
- Document retrieval success

---

## 10) Roadmap & UI Placeholders

### Coming Soon (Visible in UI)

- Native mobile app
- Additional assistants
- Expanded messaging ingestion
- Automated follow-ups
- Advanced workflow automation
- Assignment templates by service type

UI should clearly mark these as **"Coming Soon"** to set expectations.

---

## 11) Implementation Phases (High-Level)

**Phase 1 – Core MVP**

- Users & permissions
- Intake (email, voice, forwarding)
- Assignments, tasks, documents
- OCR + extraction + approval
- Drafting + approval-gated sending
- DIN letter generation

**Phase 2 – Expansion**

- Mobile app
- Additional assistants
- Smarter automation rules
- Deeper form integrations

---

## 12) Implementation Plan

### Stage 1 — UI Design Only

- ✅ Extract user stories, acceptance criteria, and list required UI parts (pages, sections, components)
- ✅ Install shadcn/ui components (Button, Card, Badge; tables/structures built with native HTML)
- ✅ Create page and components at `/workspace`; compose layout
- ✅ Create realistic mock data and placeholder content; wire into UI
- ✅ Ensure each user story is visually supported and acceptance criteria represented
- ✅ Keep interactions non-destructive (placeholders, no real logic)
- ✅ Run lint/type check and fix UI-only issues
- ✅ Add professional polish (spacing, typography, focus/hover states)
- ✅ Improve accessibility (labels, roles, ARIA, keyboard navigation, skip link)
- ✅ Verify responsive behavior and dark mode compatibility
- ✅ Add internationalization (English, German) with language toggle

### Stage 2 — Backend & Data

- ✅ Connect to data layer (JSON file at `src/data/workspace.json`)
- ✅ Replace mock data with real data from Server Action `getWorkspaceData`
- ✅ Wire UI to Server Actions; loading and error states
- ⬜ Implement CRUD operations for assignments, tasks, documents (read-only for now)

### Stage 3 — Test, Debug, and Safety Checks

- ✅ Inventory inputs (form fields, URL params, request bodies)
- ✅ Add Zod validation on client and server (early access form)
- ✅ Sanitize outputs — no `dangerouslySetInnerHTML`; user content rendered as text
- ✅ Error handling — friendly validation messages; server-side logging only
- ✅ Update UX — inline form errors, disable submit when invalid

### Level 2 — Debugging Flow & Deployment

- ✅ Prettier + ESLint integration; format-on-save; eslint-config-prettier
- ✅ ESLint fixes (no-undef, no-unused-vars); argsIgnorePattern for callbacks
- ✅ Production build succeeds; system fonts (no Google Fonts fetch at build)
- ✅ Deployment verification; live-site test checklist
- ✅ Documentation updated

### Stage 4 — Full Functionality (Not started)

- Approval flows and workflow logic
- Document ingestion and extraction
- Communications drafting and sending

---

**Stage 1 summary:** UI built at `/workspace` using shadcn/ui components (Button, Card, Badge). Mock data lives in `src/lib/mock-data.ts`. Includes Assignments list, Assignment workspace (Overview, Contacts, Documents, Tasks, Timeline), Tasks view with global/by-assignment filter, and Coming Soon section. i18n: English and German with language toggle (top-right); translations in `src/lib/i18n/translations.ts`.

**Stage 2 summary:** Route `/workspace` loads data via Server Action `getWorkspaceData()` (no params). Response shape: `{ assignments, tasks, documents, contacts, timeline, comingSoonItemKeys }`. Data source: `src/data/workspace.json`. Additional action `testOpenAI()` for API connectivity check (returns `{ ok, text }` or `{ ok: false, error }`). Loading: `loading.tsx`; errors: passed to client and rendered. Constraint: read-only; no CRUD yet.

**Stage 3 summary:** Zero Trust applied to early access form: Zod schemas at `src/lib/schemas/early-access.ts` validate email (trim, max 254, format) and locale on client and server. User content rendered as text (React escapes); no `dangerouslySetInnerHTML`. Inline errors and submit disabled when invalid.

**Level 2 summary:** Prettier + ESLint wired; format-on-save via `.vscode/settings.json`; ESLint flat config with `next/core-web-vitals` + `prettier`. Production build uses system fonts to avoid Google Fonts fetch. tsconfig excludes `.next` for type-check stability.
