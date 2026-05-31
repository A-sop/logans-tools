# Expat funnel — hackathon build log (`logans.tools/expat`)

**Product:** [Money Manual](https://go.germanfinancialplanning.de/money-manual)
**Tagline:** Digital money manual · Personal walkthrough on call
**Brand:** German Financial Planning
**PRD (Atlas):** `Atlas/docs/ideas/active/expat-funnel-hackathon-may-2026/PRD.md`
**UI reference:** [demo ramp](https://demo-ramp.com/) — report-card hero, numbered pains, process steps, score dimensions.

---

## Live URLs

| URL | Purpose |
|-----|---------|
| https://go.germanfinancialplanning.de/money-manual | **Product landing** (live) |
| https://logans.tools/expat | Hackathon build log + sprint plan |
| https://expat.logans.tools | Same build log (subdomain rewrite) |

---

## Landing page (source of truth for copy)

Fetched 2026-05-31 from [go.germanfinancialplanning.de/money-manual](https://go.germanfinancialplanning.de/money-manual):

- **Hero:** Nobody handed you the money manual when you moved to Germany.
- **CTA:** Get your money manual
- **Coach:** Logan Williams — expat financial coach in Cologne; subsidies, tax posture, long-term wealth; no product pitches or jargon.
- **Offer:** Questionnaire → teaser after submit → full manual screen-shared on call.
- **Discovery themes:** Tax savings · Retirement upside · Government support
- **Footer:** Money Manual for expats in Germany · German Financial Planning

---

## DNS + Vercel (build log subdomain)

1. **Vercel** → project **logans-tools** → Settings → Domains → Add **`expat.logans.tools`**
2. **DNS** → CNAME `expat` → `cname.vercel-dns.com.`
3. Product landing stays on **go.germanfinancialplanning.de** (separate host).

---

## Code map

| Path | Role |
|------|------|
| `src/app/expat/page.tsx` | Build log route |
| `src/app/expat/_components/expat-plan-page.tsx` | Sprint plan + mocks |
| `src/data/expat-hackathon-plan.ts` | Copy, rates, checklist (synced with live landing) |
| `src/app/page.tsx` | logans.tools homepage — Money Manual above the fold |

---

## Ship checklist (Sun 12:00)

Tracked on `/expat` P0 list. Landing is live; questionnaire + calculator + teaser remain on Base44 sprint.
