# DABOS in logans-tools

**Canonical specs:** `C:\Dev\DABOS\docs\`

**Path B (homelab — Postgres on ln02):** [Atlas/docs/admin/dabos-ln02-homelab-setup.md](../../../../Atlas/docs/admin/dabos-ln02-homelab-setup.md)

## Quick start (Path B — ln02 Postgres)

1. **On ln02** (from office PC):

   ```powershell
   & C:\Dev\Atlas\scripts\ln02\Run-Install-DabosPostgres-Ln02.ps1
   ```

2. Copy the printed **DATABASE_URL** into `C:\Dev\logans-tools\.env.local`.

3. Optional Research via ln02 Ollama:

   ```env
   OLLAMA_BASE_URL=http://<ln02-tailscale-ip>:11434/v1
   ```

4. Migrate and run:

   ```powershell
   cd C:\Dev\logans-tools
   npm run dabos:migrate
   npm run dev:webpack
   ```

5. Open **`https://dabos.logans.tools`** (production) or **`http://localhost:3001/dabos`** locally — no Logans.Tools header on DABOS routes.

## Production URL

**Canonical:** `https://dabos.logans.tools` (same Vercel project as `logans.tools`).

1. **Push** `main` → Vercel auto-deploy.
2. **Vercel** → Project → Settings → Domains → Add `dabos.logans.tools`.
3. **DNS:** `CNAME` `dabos` → `cname.vercel-dns.com.` (or the target Vercel shows).
4. Production visits to `logans.tools/dabos` redirect to the subdomain.

**Local subdomain test:** add `127.0.0.1 dabos.logans.tools` to hosts, run dev server, open `http://dabos.logans.tools:3001/`.

## Conditions (v1)

- **Product spec:** `C:\Dev\DABOS\docs\PRD-004-conditions-memory-governance.md` — ladder, multi-timescale stats, governance.
- **Implemented rules:** `src/lib/dabos/conditions.ts` — 3+ weekly points, trend on YTD percentiles → Normal / Emergency / Danger.
- **Board rollups:** `src/lib/dabos/executive-rollup.ts` — worst-wins bottleneck for DCO, Org Secretary, Executive Director.
- **Demo stats:** `npm run dabos:seed-stats` — weekly division + department points CW1 through current week.

## v1 loop

- Org map → division → department → task (UI under `src/app/dabos/`)
- API under `src/app/api/dabos/`
- Research: `POST /api/dabos/tasks/[id]/run-research`
- Conditions: 3+ stat points → badge on org map

## Migrations

SQL in `migrations/` — `npm run dabos:migrate` (uses `DATABASE_URL` from `.env.local`).

## Env vars

| Variable | Path B default |
|----------|----------------|
| `DATABASE_URL` | `postgresql://dabos:…@<ln02-tailscale-ip>:5432/dabos?sslmode=disable` |
| `OLLAMA_BASE_URL` | `http://<ln02-tailscale-ip>:11434/v1` |
| `OPENAI_API_KEY` | Optional tier-2 Research |

Neon/cloud Postgres is **not** used on Path B.
