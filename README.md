# logans.tools

Logan's tools and projects hub — overview of projects, how I work, and AI tools in use.

**Domain:** logans.tools (future: subdomains e.g. cm.logans.tools for apps)
**Board-approval preview:** use `gabc.logans.tools` for the GABC redo until concept approval.

**EÜR bookkeeping UI:** `euer.logans.tools` — LDW Books cockpit (email gate: `inbox@loganwilliams.com`). See `src/docs/project-plans/euer-books-plan.md`.

**Linear:** LT prefix (e.g. A-75)

---

## Phase 1

- Hero: Logan's tools & projects hub
- Projects overview (LDW, GFP, CM, etc.)
- How I work (stack, process, AI tools)
- Pirate Skills plug — [pirateskills.com](https://pirateskills.com)

## Phase 2

- Show Logan's own tools/work as it grows
- Add projects as they ship
- Public guide: Android phone backup via USB/LAN to local PC for external HDD backup (`/android-phone-backup`)

---

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Deploy

Vercel or similar. Connect repo, add custom domain logans.tools when ready.

**DABOS deploy order (migration 021):** apply `migrations/021_stats_conditions_superseded.sql`
(`npm run dabos:migrate`) to the target database BEFORE deploying any build that contains the
supersede readers (`superseded_at IS NULL` filters in board, stat crawl, morning plan,
establishment and department pages). Those readers have no missing-column fallback: deploying
first makes them fail with `column "superseded_at" does not exist`.
