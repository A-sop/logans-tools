# SEO Backlog — All Deferred (MVP First)

**Focus:** Ship loganwilliams.com MVP (homepage, insights, work-with-me, etc.). Everything below is for later.

---

## Ahrefs API (deferred)

**Why deferred:** API requires $500+/month (dedicated subscription) or Enterprise (~$1,500/mo). No free tier. Scraping is prohibited in ToS (section 4.3i,j) — ban risk.

**What we built:** `src/lib/ahrefs.ts`, `scripts/ahrefs-test.ts`, `src/docs/ahrefs-setup.md`. Env: `AHREFS_API_KEY`, optional `AHREFS_API_BASE`.

**Revisit when:**
- Budget allows Enterprise or API Standard ($500/mo)
- Need automated keyword sync into `SEO-KEYWORDS.md`
- Building a tool that resells or heavily automates SEO data

**Links:** [API pricing](https://ahrefs.com/api/subscription) | [ToS](https://ahrefs.com/terms) (4.3i,j)

---

## MCP & API alternatives — *backlog*

| Tool | MCP? | API? | Cost | Notes |
|------|------|------|------|-------|
| **SE Ranking** | ✅ | ✅ | $52–65/mo | Full SEO MCP. [seranking.com/api/integrations/mcp](https://seranking.com/api/integrations/mcp/) |
| **SerpAPI** | ✅ | ✅ | Free: 250/mo. $25: 1K | MCP at mcp.serpapi.com. [serpapi.com/mcp](https://serpapi.com/mcp) |
| **DataForSEO** | ❌ | ✅ | ~$0.05/task, min $50 | Keyword + SERP. [dataforseo.com](https://dataforseo.com) |
| **DataForSEO AI Keyword** | ❌ | ✅ | Per-request | AI volumes. [dataforseo.com](https://dataforseo.com/pricing/ai-optimization/ai-keyword-search-volume) |

---

## Manual keyword research — *backlog*

| Tool | Cost | Notes |
|------|------|-------|
| Google Keyword Planner | Free | Need Ads account |
| Ubersuggest | Free tier | Keyword ideas |
| Google Search Console | Free | Own site only |
| AnswerThePublic | Free / paid | Question ideas |
| Manual Ahrefs UI | $129+/mo | Export CSV |

---

## Other backlog

- [ ] SE Ranking MCP — Cursor config
- [ ] SerpAPI MCP — Cursor config
- [ ] DataForSEO API — lib client
- [ ] CSV import script → SEO-KEYWORDS
- [ ] RSS feed
- [ ] Newsletter (Supabase + Resend)
