# Deployment notes (Vercel)

Production: **logans.tools** (Vercel project `logans-tools`).

## Static marketing + i18n (Fluid CPU)

**Canonical:** `DABOS/docs/reference/vercel-static-marketing-best-practice.md`

- **Do not** call `headers()` / `cookies()` in root `app/layout.tsx` for locale or marketing layout detection.
- **Do** use middleware for host/path rules + client `LocaleProvider` where i18n applies.
- Before deploy: `npm run build` — public marketing routes should be **○ Static** / **● SSG** where possible.

**Status (2026-06-13):** Root layout is static — `RootBodyShell` picks AppShell vs standalone routes on the client; locale from middleware cookie + `LocaleProvider`.

## Verify

```bash
npm run build
vercel inspect logans.tools
```

Portfolio usage: `DABOS/docs/wiki/concepts/ldw-vercel-lean-stack.md`
