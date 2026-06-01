# GABC redesign — session closeout (2026-05-22)

Back-burner reference. Consolidated from the long Cursor chat ([transcript](./agent-transcript-2e4f60ff.jsonl)) and follow-up discussion (payments, tooling pivot).

## Repo and deploy

| Item | Location |
|------|----------|
| **Git repo** | [logans-tools](https://github.com/A-sop/logans-tools.git) — `C:\Dev\logans-tools` |
| **PRD markdown** | `src/docs/prd/gabc-*.md` |
| **Archive (this folder)** | `src/docs/prd/gabc-archive/` |
| **Preview app** | `src/app/gabc/`, `gabc-access/`, `gabc-draft/home/` |
| **Live preview** | https://gabc.logans.tools (Vercel `logans-tools`, `main`) |

## What was built (prototype)

- Email gate (`@gabc.eu`) → hub at `/gabc` with PRD tabs, migration plan, draft checklist, suggestion form (SMTP env on Vercel if emails should work).
- One draft page: `/gabc-draft/home`.
- Theme aligned to canonical `gabc.eu` blues/gold; framing softened to “early draft” (not “board approval” in UI).

## Board direction after Zoom (Cat & Jill) — not fully rewritten into PRDs

**Committed (their fight):**

- **Squarespace** — public marketing site.
- **pretix** — events/ticketing; EU/GDPR-friendly; [pretix API](https://docs.pretix.eu/dev/api/index.html) for optional future embeds.
- **HiDrive** — internal docs / governance SSOT (accepted).
- **WERO / bank-first money** — important; they want to transfer to their own bank account; treasurer owns reconciliation.
- **GDPR paramount** — avoid US providers where members/board are sensitive (Google, Mailchimp, Stripe narrative, etc.).

**Non-starters for GABC production:**

- Custom vibe-coded site as production platform.
- **Stripe** for payments (US processor story).
- Pushing “AI” / vibe coding to the board — reframe as structured prototyping if anything board-visible needs tech.

**Still valued:** Logan’s input, incremental small wins, future collaboration.

## Payments (advisory only — not your fight)

- **Stripe** was suggested in the PRD as a dev-default (pretix ecosystem, subscriptions); politically wrong for this board.
- **Operational fit:** pretix **bank transfer / invoice** + SEPA to GABC bank account; ask their bank about **SEPA Instant / WERO** for faster incoming transfers.
- **Squarespace** does not replace pretix for association-grade ticketing + reconciliation.

One-liner if asked: *pretix + bank transfer fits German Vereine; WERO is a bank question; treasurer and board own the account.*

## Logan’s role going forward (optional, low-risk)

- One-page **tooling & data map** (Squarespace / pretix / HiDrive / Mailjet — no AI language).
- pretix configuration checklist (bank transfer, references, DPA list).
- Questions for their bank on instant incoming payments.
- Do **not** own treasurer reconciliation or payment product decisions unless explicitly scoped and funded.

## Emails drafted in chat

Board / post-Zoom follow-ups were written in the agent chat only — **not** committed as files. Search the transcript for “email” or “Cat” if you need wording.

## Cursor plan (archived)

Original plan file: `gabc.eu_redesign_prd_f69b07a6.plan.md` → [cursor-plan-gabc.eu-redesign-prd.md](./cursor-plan-gabc.eu-redesign-prd.md)

Todos from that plan (workshop, audit, IA, CMS, codex phasing) were completed into `src/docs/prd/` deliverables.

## Other repos (tangential)

| Repo | GABC content |
|------|----------------|
| **Atlas** | Builder Codex roadmap only (`docs/admin/roadmap.md`) — no GABC-specific docs |
| **loganwilliams-website** | Personal archive insight only (`content/insights/gabc-executive-board-candidacy-archive.md`) |
| **DABOS** | None |

## Open if you pick this up later

- [ ] Add a short “production tooling” section to `gabc-redesign-prd.md` (Squarespace + pretix, no Stripe).
- [ ] Optional `gabc-tooling-data-map.md` one-pager for the board.
- [ ] Remove debug headers in `middleware.ts` if still present.
- [ ] Configure Vercel SMTP env for suggestion form.
- [ ] Remaining draft pages (Events, Membership, About, Contact, Legal) — checklist only today.

## Transcript

Full JSONL: [agent-transcript-2e4f60ff.jsonl](./agent-transcript-2e4f60ff.jsonl)
Cursor transcript ID: `2e4f60ff-24b3-4394-b57b-b366bf666ed7`
