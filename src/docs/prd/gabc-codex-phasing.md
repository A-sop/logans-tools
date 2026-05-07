# GABC — Builder Codex Phasing (L1–L3 for Phase 1)

This maps the GABC Phase 1 (board approval marketing site) to the in-repo Builder Codex roadmap at `Atlas/docs/admin/roadmap.md`.

## Phase 1 goal

Ship a board-reviewable marketing site to **`gabc.logans.tools`** with: Home, Events, Membership, About, Contact, Legal, and the `/gabc` board hub.

---

## Level 1 — Get your idea live (Phase 1)

- **1.1 Your Idea**
  - Concept + PRD docs already created in:
    - `src/docs/prd/gabc-redesign-prd.md`
    - `src/docs/prd/gabc-migration-plan.md`
    - `src/docs/prd/gabc-ia-wireframes.md`
- **1.2 Local Setup**
  - `logans-tools` already runs locally; preview-gate + board hub exist.
- **1.3 Landing Page**
  - Phase 1 public pages become the “landing” surface (Home + key CTAs).
  - Style aligned to canonical `gabc.eu` palette (blue + gold on light).
- **1.4 Fixing Errors**
  - Standard: `npm run build` passes before shipping.
- **1.5 Safety First**
  - Preview gate on `gabc.*` host; form validation + honeypots on suggestion forms.
- **1.6 Going Live**
  - Deploy to Vercel and attach `gabc.logans.tools` as the board-approval domain.

---

## Level 2 — Ship your first feature (Phase 1)

- **2.1 First Features**
  - Implement Phase 1 pages as first shipped feature set:
    - `/events` list + detail (initially static/MDX)
    - `/membership` tier comparison + apply CTA
    - `/about` + `/contact` + `/legal/*`
- **2.3 UI Components**
  - Use existing shadcn/ui components (Card, Tabs, Button, FormField, etc.).
- **2.4 Real Functions**
  - Already: PRD suggestions email to `logan.williams@gabc.eu`.
  - Next: event registration CTA routing (external link for Phase 1).
- **2.5 Zero Trust**
  - Zod validation at boundaries; no secrets in client; anti-spam (honeypot).
- **2.6 Debugging Flow**
  - Keep builds green; lint/format before cutting preview releases.

---

## Level 3 — Store your data (Phase 1 vs later)

Phase 1 should **avoid heavy data systems** unless required for editorial workflow.

- **3.1–3.3** already effectively covered by docs + style tokens.
- **3.4 Saving Data (optional for Phase 1)**
  - If events/news must be editable by non-devs **in Phase 1**, pick a headless CMS.
  - If dev-owned for board preview, store events/posts as MDX and migrate later.
- **3.6 Git Workflow**
  - Keep work on a branch and merge when ready for board preview releases.

---

## Levels 4–6 (explicitly out of Phase 1 scope)

Only after concept approval:

- **L4 Accounts:** member portal, roles, entitlements
- **L5 Integrations:** CRM sync, advanced email automation
- **L6 Monetization:** Stripe recurring membership, tickets, paid docs, WERO feasibility

