# Expat funnel — hackathon build log (`logans.tools/expat`)

**Product:** [Money Manual](https://go.germanfinancialplanning.de/money-manual)
**Tagline:** Digital money manual · Personal walkthrough on call
**Brand:** German Financial Planning
**Product repo:** [github.com/A-sop/german-financial-planning](https://github.com/A-sop/german-financial-planning)
**PRD (Atlas):** `Atlas/docs/ideas/active/expat-funnel-hackathon-may-2026/PRD.md`
**UI reference:** [demo ramp](https://demo-ramp.com/) — report-card hero, numbered pains, process steps, score dimensions.

---

## Live URLs

| URL | Purpose |
|-----|---------|
| https://go.germanfinancialplanning.de/money-manual | **Product landing** |
| https://go.germanfinancialplanning.de/money-manual/start | Dossier wizard |
| https://go.germanfinancialplanning.de/money-manual/teaser | Teaser after submit |
| https://go.germanfinancialplanning.de/money-manual/book | Calendly booking |
| https://logans.tools/expat | Hackathon build log + sprint plan |
| https://expat.logans.tools | Same build log (subdomain rewrite) |

---

## Shipped stack (GFP repo)

| Layer | Tools |
|-------|--------|
| App | Next.js 15 · React 19 · TypeScript · Vercel |
| Host | `go.germanfinancialplanning.de` via `middleware.ts` |
| Leads | Neon Postgres · optional Attio sync |
| Calculator | `calculator-config.json` · `calculate-advantages.ts` |
| Booking | Calendly embed |
| Admin | `/admin/campaign-leads` |

Base44 is hackathon sponsor only — product built in Next.js.

---

## Code map

| Repo / path | Role |
|-------------|------|
| `german-financial-planning/src/campaigns/set-up-germany/` | Landing, dossier, teaser, book, report templates |
| `german-financial-planning/src/lib/campaign-leads-repository.ts` | Neon lead storage |
| `logans-tools/src/app/expat/` | Build log route |
| `logans-tools/src/data/expat-hackathon-plan.ts` | Copy, rates, checklist (synced with live funnel) |
| `logans-tools/src/app/page.tsx` | logans.tools homepage — Money Manual above the fold |

---

## Ship checklist (Sun 12:00)

Tracked on `/expat` P0 list. **MVP funnel is live** on go.germanfinancialplanning.de. Remaining: Impressum/Datenschutz link on campaign host, pitch rehearsal, optional Resend email.
