# DABOS in logans-tools

**Canonical specs:** `C:\Dev\DABOS\docs\`

**Path B (homelab — Postgres on ln02):** [DABOS dabos-ln02-homelab-setup.md](../../../../DABOS/docs/reference/dept09-assets/dabos-ln02-homelab-setup.md)

## Quick start (Path B — ln02 Postgres)

1. **On ln02** (from office PC):

   ```powershell
   & C:\Dev\DABOS\scripts\dept09-assets\ln02\ln02\Run-Install-DabosPostgres-Ln02.ps1
   ```

2. Copy the printed **DATABASE_URL** into `C:\Dev\logans-tools\.env.local`.

3. Research via **ln02** Ollama (workhorse):

   ```env
   OLLAMA_BASE_URL=http://100.127.110.57:11434/v1
   OLLAMA_MODEL=llama3.2:3b
   ```

   After Ollama upgrade (Track C): optional `OLLAMA_MODEL=gemma4:e2b-it-qat`.

4. Migrate and run:

   ```powershell
   cd C:\Dev\logans-tools
   npm run dabos:migrate
   npm run dev:webpack
   ```

5. Open **`https://dabos.logans.tools`** (production) or **`http://localhost:3100/dabos`** locally (`npm run dev` binds **3100** so Twenty CRM can keep **3000**) — no Logans.Tools header on DABOS routes.

## Shared ingest (I0)

Parallel IN-baskets → one Neon comm center (ESTO flap §F).

- **API:** `POST /api/dabos/ingest` (Tier0 Bearer / cron / Clerk)
- **Doc:** `DABOS/docs/reference/dept02-coordination/shared-ingest-i0.md`
- **Telegram:** ln02 capture dual-writes when `DABOS_INGEST_URL` + `DABOS_TIER0_SECRET` set
- **Slack:** free-text in allowed DM/channel → same ingest (commands still `/dabos`)
- **Buzz:** same POST body when bot exists

## Open loops dashboard

Cross-project scan of founder-desk **OPEN-CHAT-BACKLOG** + **SHIP-BOARD** (not the Neon task board).

- **URL:** `https://dabos.logans.tools/open` (nav: **Open**)
- **Refresh snapshot** (from a machine with DABOS cloned next to this repo, or set `DABOS_ROOT`):

  ```powershell
  cd C:\Dev\logans-tools
  $env:DABOS_ROOT = 'C:\Dev\DABOS'
  npm run dabos:sync-open-loops
  ```

  Then commit `src/data/dabos-open-loops.json` and deploy. Vercel cannot read the DABOS tree at runtime.

## Production URL

**Canonical:** `https://dabos.logans.tools` (same Vercel project as `logans.tools`).

1. **Push** `main` → Vercel auto-deploy.
2. **Vercel** → Project → Settings → Domains → Add `dabos.logans.tools`.
3. **DNS:** `CNAME` `dabos` → `cname.vercel-dns.com.` (or the target Vercel shows).
4. Production visits to `logans.tools/dabos` redirect to the subdomain.

**Local subdomain test:** add `127.0.0.1 dabos.logans.tools` to hosts, run dev server, open `http://dabos.logans.tools:3001/`.

## Founder comm lines (Tier 0)

| Channel | Where | Runbook |
|---------|-------|---------|
| **Slack** (primary target) | Vercel `/api/dabos/slack/events` + `/commands` | [dabos-slack-gateway.md](../../../../DABOS/docs/reference/dept09-assets/dabos-slack-gateway.md) |
| **sipgate Assist** | `POST /api/dabos/sipgate/assist` · inbox `/dabos/sipgate` | `Proviso/docs/reference/sipgate-webhook-relay.md` |
| **Telegram Inbox** | ln02 `dabos-telegram-capture` | [dabos-telegram-capture.md](../../../../DABOS/docs/reference/dept09-assets/dabos-telegram-capture.md) |
| **Telegram Comm** | ln02 `dabos-telegram-exec` → Tier 0 API | [dabos-telegram-exec.md](../../../../DABOS/docs/reference/dept09-assets/dabos-telegram-exec.md) |

Tier 0 API (shared): `/api/dabos/tier0/stats`, `board`, `approvals` — auth via `DABOS_TIER0_SECRET`. Sync: `DABOS/scripts/dept09-assets/ln02/Sync-Tier0Secret-Vercel-Ln02.ps1`.


`/dabos`, `dabos.logans.tools`, and `/api/dabos/*` require Clerk sign-in. Only emails in `DABOS_ALLOWED_EMAILS` may access the board (default: `logan.d.williams@gmail.com`).

**`.env.local` (add to existing DABOS vars):**

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dabos
DABOS_ALLOWED_EMAILS=logan.d.williams@gmail.com
```

**Clerk Dashboard (one-time):**

1. Create or reuse a Clerk application for logans-tools.
2. **Social connections → Google** — enable (see `src/docs/google-sign-in-setup.md`).
3. **User & Authentication → Restrictions** — optional extra lock: disable sign-ups or restrict to allowlist.
4. **Domains** — add `dabos.logans.tools`, `logans.tools`, `localhost:3100` (dev; port 3000 is Twenty on HZR).
5. **Vercel Production env** — use `pk_live_` / `sk_live_` keys; mirror redirect URLs above.

Unauthenticated visits redirect to `/sign-in`. Wrong Gmail → 403 / access denied.

### Clerk JS failed to load (`clerk.logans.tools` / `failed_to_load_clerk_js`)

**Cause:** Production custom domain (`clerk.logans.tools`) is not wired to Clerk’s CDN — DNS often points at Vercel instead, so the JS URL 404s.

**Local dev fix:**

1. Use **Development** keys only in `.env.local`: `pk_test_…` / `sk_test_…` (Clerk Dashboard → **Development** → API keys).
2. Keep **one** copy of each Clerk var (no duplicate lines).
3. Restart dev server.

**Production fix (when you want custom domain):** Clerk Dashboard → **Configure → Domains** → follow Clerk’s DNS records for `clerk.logans.tools`. Do **not** point that subdomain at Vercel unless you proxy Clerk’s frontend API per their docs.

Until DNS is correct, use default Clerk hosting (no custom primary domain) or Production keys only on Vercel after domain verification.

## Production database (Neon vs ln02)

| Where the app runs | Recommended `DATABASE_URL` |
|--------------------|----------------------------|
| **Office PC dev** (`npm run dev`) | ln02 Tailscale (`100.127.110.57:5432`) — Path B |
| **Vercel** (`dabos.logans.tools`) | **Neon** (or other internet-reachable Postgres). Vercel cannot reach ln02 over Tailscale. |

**Practical split:** keep ln02 for homelab dev; provision a Neon project for Vercel Production, run `npm run dabos:migrate` against both when schema changes. Same migrations in `migrations/`.

**Alternative:** run Next.js on ln02 with `DATABASE_URL=...@127.0.0.1:5432/...` and point `dabos.logans.tools` at ln02 via tunnel — see [dabos-ln02-homelab-setup.md](../../../../DABOS/docs/reference/dept09-assets/dabos-ln02-homelab-setup.md) § Later.

## Conditions (v1)

- **Product spec:** `C:\Dev\DABOS\docs\PRD-004-conditions-memory-governance.md` — ladder, multi-timescale stats, governance.
- **Implemented rules:** `src/lib/dabos/condition-ladder.ts` + `conditions.ts` — 3+ weekly points, relative trend → PRD-004 upper ladder (Power Change … Non-Existence).
- **Board rollups:** `src/lib/dabos/executive-rollup.ts` — worst-wins bottleneck for DCO, Org Secretary, Executive Director.
- **Demo stats:** `npm run dabos:seed-stats` — weekly division + department points CW1 through current week.

## v1 loop

- Org map → division → department → task (UI under `src/app/dabos/`)
- API under `src/app/api/dabos/`
- Research: `POST /api/dabos/tasks/[id]/run-research`
- Conditions: 3+ stat points → badge on org map

## Cadence (PC-off safe)

**Org week:** Thursday **14:00** boundary and stats cutoff (**Europe/Berlin**) — countdown on every `/dabos` page (top left).

| Job | Local | Vercel Cron (UTC) |
|-----|-------|-------------------|
| Morning plan | `npm run dabos:morning-plan` | `30 5 * * *` (~07:30 Berlin) |
| Refresh conditions | `npm run dabos:refresh-conditions` | `0 18 * * *` (~20:00 Berlin) |
| Week close | `npm run dabos:week-close` | `0 14 * * 4` (Thu — tune for CET/CEST) |

**Vercel:** set `DABOS_CRON_SECRET` in Production env. Crons defined in `vercel.json`. Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically when using their cron feature — for manual/ln02 calls use the same header or `x-dabos-cron-secret`.

**ln02 (optional):** `DABOS/scripts/dept02-coordination/dabos/ln02-run-cadence.sh morning-plan|week-close|refresh-conditions`

**Week-close poster window (Dept11, 2026-10-29):** the division poster reports the org week that **closed** at the most recent Thu 14:00 Europe/Berlin (DABOS `.agents/roles/_standing-orders.md` line 47 at main 37aff075: "Stat week: Thursday 14:00 Europe/Berlin close"), not the ISO Mon-Sun week and not the week that just started. `div-live-YYYY-Www` = ISO week of the closing Thursday; `recorded_at` = close minus 1 ms. Timestamped register entries use the exact Thu 14:00 cutoff. **Provisional (pending Dept14 ruling):** date-only entries count opening Thu..Wed, so a row dated the closing Thursday goes to the NEXT week (it cannot prove it was before 14:00, and the 14:30 run is insert-once, so this way it is counted next week instead of lost). `shipped_outputs` counts ship-log rows only when `Validated (Dept13)` is `PASS <date>` (not pending / FAIL / CONDITIONAL) and Counts=yes, bucketed by the PASS date, not the ship Date. `qa_pass_rate` counts per Dept13 verdict instance (`## Instance N`), not per PR or SHA; `Verdict:` may be bold, bold-label or plain, and pending verdicts do not count. Both count only entries inside the window; `qa_pass_rate` with 0 verdicts posts **no row** (to-report). Conditions: week-close **reports** each division's recorded condition (`formula`, or `founder_ruling` with both `ruling_date` and `ruling_ref`, in `entity_condition_state`) and otherwise `to-report`; it does not assign or refresh conditions unless `DABOS_WEEK_CLOSE_REFRESH_CONDITIONS=1` (a refresh error is reported, not fatal). On Vercel the cron route is cloud-only by design (division stats need the local registers, so ln02 posts them; `DABOS_WEEK_CLOSE_CLOUD_ONLY=0` overrides). `--week=YYYY-Www` on `post-division-weekly-stats` must be a real ISO week or the script exits non-zero (code: `src/lib/dabos/org-week-window.ts`, `week-close-conditions.ts`).

**Stat week single source (Dept11, 2026-10-30):** founder ruling 2026-10-30 (relayed by LDW Communicator / Div7): the stat week closes on Thursday and Friday starts the new week. `src/lib/dabos/org-week.ts` is the only place the boundary is defined (Thu 14:00 Europe/Berlin, `WEEK_BOUNDARY_HOUR`; **open question for Dept13 / Logan:** the ruling does not name an hour, 14:00 vs end of Thursday). A stat week is `[Thu 14:00, next Thu 14:00)` Berlin, labelled `YYYY-Www` = ISO week of the closing Thursday (2026-W44 = Thu 22 Oct 14:00 -> Thu 29 Oct 14:00). The GFP poster (`gfp-live-YYYY-Www`), division poster, stat crawl, org-board week slider / charts / YTD window and the YTD seed all use it; nothing in `src/lib/dabos` uses ISO Mon-Sun weeks any more. The board keeps rows whose `workspace_id` ends in `-YYYY-Www` in their labelled week (so pre-change `gfp-live` rows recorded at the ISO Sunday end stay in their week); other rows go to the stat week containing `recorded_at`. Vercel crons (UTC): `week-close` `30 13 * * 4` (14:30 CET / 15:30 CEST) and `stat-crawl` `0 14 * * 4` (15:00 CET / 16:00 CEST), both after the Thu 14:00 Berlin close in summer and winter time.

**Windows office PC:** `DABOS/scripts/dept02-coordination/dabos/schedule-dabos-cadence.ps1`

## Migrations

SQL in `migrations/` — `npm run dabos:migrate` (uses `DATABASE_URL` from `.env.local`).

## Env vars

| Variable | Path B default |
|----------|----------------|
| `DATABASE_URL` | `postgresql://dabos:…@<ln02-tailscale-ip>:5432/dabos?sslmode=disable` |
| `OLLAMA_BASE_URL` | `http://100.127.110.57:11434/v1` (ln02 workhorse) |
| `OLLAMA_MODEL` | `llama3.2:3b` or `gemma4:e2b-it-qat` after upgrade |
| `DABOS_CRON_SECRET` | Vercel cron + ln02 curl auth (generate random string) |

Neon/cloud Postgres is **not** used on Path B.

## References

- **PRD-004 conditions:** `C:\Dev\DABOS\docs\PRD-004-conditions-memory-governance.md`
- **UI motion (optional):** [animejs.md](../../../../DABOS/docs/reference/animejs.md) — [Anime.js v4](https://animejs.com/documentation/) for org-board/dashboard animation; also GFP, LDW, logans.tools when timelines or scroll-sync beat CSS-only
