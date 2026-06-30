<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Deploy & Vercel CPU

- **`docs/DEPLOYMENT-NOTES.md`** — domains, subdomains, build verify.
- **DABOS** `docs/reference/vercel-static-marketing-best-practice.md` — no `headers()` in root layout; middleware + client shell/locale.

Before production deploy: `npm run build` — apex marketing routes should be **○ Static** where possible.

## Atlas workspace routing

This repo follows the Atlas agent harness.

Read first for shared policy, secrets, CLI/MCP access order, and database direction:
C:\Dev\Atlas\docs\admin\agent-harness.md

Routing rule:

- Atlas = shared policy, canonical secrets inventory, Linear scripts, cross-repo context, second-brain/ops docs.
- This repo = product code, repo-specific docs, tests, build/deploy config, and local implementation decisions.
- Do not duplicate Atlas policy here; link to it and keep only repo-specific differences in this file.
- When working in a multi-root workspace, read Atlas for shared context but edit this repo only for this repo's code/docs.

Agent identity rule: before or when making changes, state Model, Agent, and Surface.

Access rule: CLI first, repo scripts/API second, MCP third, browser/dashboard last.

Database rule: new online DB work uses Neon Postgres via DATABASE_URL. Supabase is legacy/off-boarding unless explicit old-code maintenance requires it.

Repo role: Logan's tools/app repo. Use this repo for shipped tool surfaces, including DABOS implementation code when relevant.
