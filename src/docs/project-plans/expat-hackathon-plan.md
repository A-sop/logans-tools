# Expat funnel — hackathon build log (`expat.logans.tools`)

**Product (working title):** German-AI-der
**Offer:** Set Yourself Up in Germany
**PRD (Atlas):** `Atlas/docs/ideas/active/expat-funnel-hackathon-may-2026/PRD.md`
**UI reference:** [demo ramp](https://demo-ramp.com/) — report-card hero, numbered pains, process steps, score dimensions.

---

## Live URLs

| URL | Purpose |
|-----|---------|
| https://expat.logans.tools | Hackathon WIP plan (this deploy) |
| https://logans.tools/expat | Same page on apex (no DNS change needed) |

---

## DNS + Vercel (one-time)

1. **Vercel** → project **logans-tools** → Settings → Domains → Add **`expat.logans.tools`**
2. **Namecheap** (or authoritative DNS for `logans.tools`) → add record:

   | Type | Host | Value |
   |------|------|-------|
   | CNAME | `expat` | `cname.vercel-dns.com.` |

   If NS is Vercel DNS, add the domain in Vercel UI only.

3. Wait for cert provisioning, then open https://expat.logans.tools

See also [dns-and-domains-playbook.md](https://github.com/loganwilliams/Atlas/blob/main/docs/troubleshooting/dns-and-domains-playbook.md) in Atlas.

---

## Code map

| Path | Role |
|------|------|
| `src/app/expat/page.tsx` | Route entry |
| `src/app/expat/_components/expat-plan-page.tsx` | Marketing WIP page (demo-ramp inspired) |
| `src/data/expat-hackathon-plan.ts` | Sprint data, rates, checklist |
| `middleware.ts` | `expat.*` → `/expat` rewrite + marketing layout |
| `src/app/layout.tsx` | Skips AppShell when `x-marketing-layout` |

---

## Ship checklist (Sat 20:00)

Tracked on the live page P0 list. Product MVP ships on Base44 (or fallback); this subdomain stays the **build log + plan** until product URL is ready.
