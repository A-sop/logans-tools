# Feature Planning

**Chosen Next Feature:** Document Intake → Saved Task Suggestions — 260131

- **Rationale:** High impact (solves manual, error-prone task extraction) vs medium effort (UI + OCR + OpenAI + Supabase; persistence already scaffolded). Chosen now because Supabase is wired and the concept defines a clear one-week slice.
- **Concept:** [concept-document-intake.md](./concept-document-intake.md)
- **Next:** Create `src/docs/document-intake-prd.md` and follow Level 2 (UI → real functionality → Zero Trust → debug → ship).

---


## 1. Must-Haves

| Item | Impact | Effort |
|------|--------|--------|
| **Persist early access emails** — Form submits but nothing is stored; need a data layer to capture signups. | high | med |
| **CRUD for assignments** — Workspace is read-only; users need to create, edit, and manage assignments. | high | high |
| **Update metadata** — Root layout still uses "Create Next App"; replace with product name and description. | low | low |
| **Document ingestion** — PRD core: turn uploaded documents into structured assignment data. | high | high |
| **Approval flows** — Outbound communications and sensitive updates require human approval before execution. | high | high |

## 2. Bugs & Ideas

| Item | Impact | Effort |
|------|--------|--------|
| **Turbopack cache corruption** — `.next` can corrupt; document "delete .next and restart" as a troubleshooting step. | low | low |
| **Port conflict message** — When 3000 is in use, Next.js switches to 3001; consider making this more obvious in UI or docs. | low | low |
| **Geist fonts** — Replaced with system fonts for build; optionally reintroduce via local font files if branding requires it. | low | med |
| **OpenAI test card** — Consider moving from workspace to a dev/admin area for production cleanliness. | low | low |

## 3. Future — Admin access control

| Item | Impact | Effort |
|------|--------|--------|
| **Admin-level access assignment** — Admins assign who has access to what (permissions, visibility). Not in scope now; revisit when needed. | high | high |

---

## 4. Fun

| Item | Impact | Effort |
|------|--------|--------|
| **Native mobile app** — Roadmap item; improves access for on-the-go professionals. | high | high |
| **Assignment templates by service type** — Relocation, business setup, etc.; speeds up onboarding new clients. | med | med |
| **Automated follow-ups** — System suggests or sends reminders based on task due dates and status. | high | high |
| **Additional assistants** — Scale beyond 1 assistant per account; team collaboration. | med | high |
| **Voice instructions** — Speech-to-text intake; aligns with accessibility focus for target audience. | high | high |

---

## Todos

- [ ] **Feature voting in production** — Votes and user suggestions currently persist to `features.json`; Vercel’s filesystem is read-only, so they only work locally. Add a database (or external store) when available so voting/submissions work in production.
- [ ] **SOP PDF export** — Allow users to generate PDFs of individual SOPs or the full SOP set for printing or sharing.
- [ ] **SOP wiki page** — A wiki-style reference view for SOPs (browseable, linkable, searchable) for later reference.
- [ ] **SOP voice add/edit** — Super admin can add and edit SOPs by voice (speech-to-text).

---

## Proposed next feature (~1 week)

**Option A — Persist early access emails**  
Solves a real gap: the form appears to work but does nothing with signups. Add a simple storage layer (JSON file or Supabase) to store emails and optionally sync to a list. Fits the product’s “capture” and “reduce fragmentation” goals.

**Option B — Basic assignment CRUD (add + edit)**  
Core product value: turn the workspace from read-only into a tool where users can add and edit assignments. Scope to a minimal add form and edit form, wired to the existing JSON data layer. Directly supports “clear, trackable actions” from the concept.

---

Choose one: **A** or **B**

---

Updated: 260201
