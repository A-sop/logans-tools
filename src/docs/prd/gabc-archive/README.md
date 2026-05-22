# GABC project archive

Local-only materials from the GABC redesign chat (Cursor plan, session closeout, full agent transcript) live here so nothing depends on `.cursor/` paths on your machine.

## Start here

| File | What it is |
|------|------------|
| [chat-closeout-2026-05-22.md](./chat-closeout-2026-05-22.md) | Readable summary: decisions after Zoom, payments (WERO, no Stripe), where code/docs/deploy live |
| [cursor-plan-gabc.eu-redesign-prd.md](./cursor-plan-gabc.eu-redesign-prd.md) | Copy of Cursor plan `gabc.eu_redesign_prd_f69b07a6.plan.md` (2026-04) |
| [agent-transcript-2e4f60ff.jsonl](./agent-transcript-2e4f60ff.jsonl) | Full agent chat export (JSONL, one event per line) |

## Active PRD / planning docs (sibling folder)

Still the working set under `src/docs/prd/`:

- `gabc-redesign-prd.md` — main PRD (preview hub renders this)
- `gabc-migration-plan.md`
- `gabc-stakeholder-workshop.md`, `gabc-content-audit.md`, `gabc-ia-wireframes.md`, `gabc-cms-choice.md`, `gabc-codex-phasing.md`
- `../project-plans/gabc-website-plan.md`

## Preview app (code)

- `src/app/gabc/`, `src/app/gabc-access/`, `src/app/gabc-draft/home/`
- Live: https://gabc.logans.tools (Vercel project `logans-tools`, branch `main`)

## Source paths on disk (archived copies supersede these)

| Original | Archived copy |
|----------|----------------|
| `C:\Users\Logan\.cursor\plans\gabc.eu_redesign_prd_f69b07a6.plan.md` | `cursor-plan-gabc.eu-redesign-prd.md` |
| `C:\Users\Logan\.cursor\projects\c-Dev-Atlas\agent-transcripts\2e4f60ff-24b3-4394-b57b-b366bf666ed7\2e4f60ff-24b3-4394-b57b-b366bf666ed7.jsonl` | `agent-transcript-2e4f60ff.jsonl` |

## Status (back burner)

GABC board direction (post–Zoom): **Squarespace** (public site) + **pretix** (events/ticketing, EU/GDPR). **Stripe** and full custom production stack are non-starters for them. **WERO / bank-first payments** are their preference; not Logan’s decision to drive.

`gabc.logans.tools` remains a **prototype lab**, not production.
