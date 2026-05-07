# GABC Website Redo (Board-Approval Preview) — Project Plan

**Goal:** Rebuild the German Australian Business Council website experience as a modern, fast, accessible marketing site.

**Tracking home (for now):** this `logans-tools` repo.

**Preview environment (board approval):** `gabc.logans.tools`

**Rule:** Anything “to be board approved” ships to `gabc.logans.tools` first. Once approved, we either:

- create a new repo for GABC, or
- create a new git root if we decide to separate it completely.

---

## Scope (Phase 1 — Marketing Site)

- **Homepage** — clear positioning, benefits, patrons proof, testimonials, chapters.
- **Events** — list + detail; clear registration CTA (external or embedded).
- **Membership** — tiers/benefits + application CTA (form or external).
- **About** — council story, board, chapters, non-profit framing.
- **Contact** — address + inquiry form.
- **Legal** — Impressum, Datenschutz, Cookies (as applicable).

**Out of scope for board-preview:** member portal, payments, CRM replacement.

---

## Success criteria (board approval)

- Page clarity: a first-time visitor can answer “what is GABC / why join / what next?” in under 60 seconds.
- Mobile-ready and accessible baseline (keyboard nav, contrast, semantic headings).
- Event discovery is easy; membership is understandable; patrons/corporate members are credible.
- No broken links; metadata and social share previews are sane.

---

## Deployment notes (Vercel)

- **Preview URL:** deploy to a Vercel project connected to this repo.
- **Custom domain:** attach `gabc.logans.tools` as the “board approval” domain.
- Keep the production `logans.tools` deployment unchanged until we intentionally switch.

---

## PRD reference

If/when we write the full PRD, structure it around:

- the current site (`https://gabc.eu/`) content pillars (events, membership, council/about, patrons, chapters),
- the Builder Codex roadmap framing in `Atlas/docs/admin/roadmap.md` (Levels 1–6, pillars),
- and a single primary conversion journey for Phase 1 (membership or events).

