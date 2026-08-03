<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Deploy & Vercel CPU

- **`docs/DEPLOYMENT-NOTES.md`** — domains, subdomains, build verify.
- **DABOS** `docs/reference/vercel-static-marketing-best-practice.md` — no `headers()` in root layout; middleware + client shell/locale.

Before production deploy: `npm run build` — apex marketing routes should be **○ Static** where possible.

## DABOS foundation routing

This repo **ships product code**. The org foundation lives in **DABOS**.

1. Read first: `C:\Dev\DABOS\docs\reference\dept20-organizing\agent-harness.md`
2. Workspace: open **DABOS + this repo only** (use `DABOS-logans-tools.code-workspace`).
3. Env: `C:\Dev\DABOS\.env.local` (this repo’s `.env.local` must link there — `Link-DabosEnvLocal.ps1`).
4. Template (names only): `C:\Dev\DABOS\docs\reference\dept09-assets\homelab-and-api-keys.template.env`
5. Scripts: `C:\Dev\DABOS\scripts\deptNN-*` — Linear under `dept02-coordination/linear/`.
6. Hats: `C:\Dev\DABOS\.agents\roles/` when acting as a department.
7. On changes, declare: **Model**, **Agent**, **Surface**.
8. Access order: CLI → repo scripts/API → MCP → browser/dashboard.
9. New online DB: Neon via `DATABASE_URL`. Supabase is legacy only.
10. DVAG / client / restricted data stay local — never third-party cloud.

**Forbidden:** inventing `docs/ops/`, second harness copies, new `private/*keys.env` inventories, catchall folders, or a second org board.

**Repo role:** Logan's tools / app surface — including DABOS board UI, office status/triage/DIL/debt routes under `/dabos/*`. Do not absorb foundation policy here — link to DABOS.
