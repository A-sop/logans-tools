<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Deploy & Vercel CPU

- **`docs/DEPLOYMENT-NOTES.md`** — domains, subdomains, build verify.
- **DABOS** `docs/reference/vercel-static-marketing-best-practice.md` — no `headers()` in root layout; middleware + client shell/locale.

Before production deploy: `npm run build` — apex marketing routes should be **○ Static** where possible.
