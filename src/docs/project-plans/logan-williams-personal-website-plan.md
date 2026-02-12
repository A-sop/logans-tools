# Logan Williams Personal Website — Project Plan

**Goal:** MVP of loganwilliams.com — published, modern, founder-led feel like [pirateskills.com](https://pirateskills.com/), with regular updates inspired by [Captain's Insights](https://pirateskills.com/insights).

**Current site:** [loganwilliams.com](https://www.loganwilliams.com/)  
**Target feel:** [pirateskills.com](https://pirateskills.com/) — bold, clear, human, no clutter.  
**Content inspiration:** [pirateskills.com/insights](https://pirateskills.com/insights) — weekly insights, short reflections, life-in-Germany and life-in-general commentary.

---

## MVP Scope

- **No login** at this stage — public site only.
- **Homepage** — hero, "this is me", main sections, CTA.
- **Insights / Blog** — regular updates (Life in Germany, personal finance, book club, general commentary).
- **Work with Me** — financial planning for expats; clear value prop, contact/calendly.
- **Book Club** — landing/callout; link to future meetups.
- **Footer** — legal, contact, social.

---

## How to Create This Project From Current Codebase

### 1. Clone and Strip

```powershell
# From c:\Dev\
git clone <my-app-repo> loganwilliams-website
cd loganwilliams-website
```

### 2. Remove CM-Specific / Auth / Payment Code

Delete or ignore for MVP:

- `src/app/sign-in/`, `src/app/sign-up/`, `src/app/onboarding/`
- `src/app/workspace/` (full workspace, tasks, documents)
- `src/app/pricing/`, `src/app/changelog/` (unless you want changelog later)
- `src/app/api/webhooks/` (Clerk, n8n)
- `supabase/migrations/` (all)
- `src/lib/supabase-*`, `src/lib/webhook-*`
- Package deps: `@clerk/nextjs`, `@supabase/supabase-js` (add back only when needed)
- Scripts: `send-clerk-webhook.ts`, `test-n8n-webhook.ts`
- Docs: `src/docs/auth-flow/`, `src/docs/payment-*/`, `src/docs/workspace-*`, `src/docs/builder-codex/` (keep only as reference if useful)
- `.cursor/rules/` — remove `clerk-integration.mdc`, `database-migrations.mdc`, `linear-task-management.mdc`; keep `tech-stack`, `design-system`, `security`, `session-reminders` (simplify)

### 3. Keep and Adapt

| From | Use for |
|------|---------|
| `scripts/setup-env.js` | Create .env.local from .env.example |
| `scripts/check-env-keys.js` | Simplify to empty or minimal (no Clerk/Supabase for MVP) |
| `.cursor/rules/tech-stack.mdc` | Remove Supabase, Clerk; keep Next.js, Tailwind, shadcn |
| `.cursor/rules/design-system.mdc` | Use as-is; palette can lean warmer/more personal |
| `src/docs/automation-for-next-project.md` | Reference for future integrations |
| `GIT-WORKFLOW.md` | Same flow; update repo URL |
| `CHAT-PRIMER.md` | Rewrite for Logan site context |

### 4. New .env.example (MVP)

```bash
# No secrets required for static/markdown blog MVP
# Add when you add contact form, analytics, etc.
```

### 5. Content Strategy

- **Insights** — MDX files in `src/content/insights/` or similar; one file per post.
- **Structure** — `[date]-[slug].mdx` or `[slug]/page.mdx`.
- **RSS** — Optional; easy to add with `next-mdx-remote` or contentlayer.

---

## Prompt for AI (Copy Into New Chat)

```
Create a personal website for Logan Williams (loganwilliams.com) with this brief:

**Audience:** Expats in Germany; people interested in financial planning, life in Germany, and thoughtful commentary.

**Design reference:** https://pirateskills.com/ — bold headline, clear sections, human tone, minimal clutter. Not corporate. Founder-led.

**Content inspiration:** https://pirateskills.com/insights — regular "Captain's Insights" style updates. Short, punchy, actionable or reflective.

**Sections to build:**
1. Homepage — hero ("Hey, I'm Logan"), "This is me now" (bio), links to Life in Germany, Work With Me, Personal Finance, Book Club.
2. Insights / Blog — list latest posts; each post has date, title, excerpt, link. Content from MDX files.
3. Work With Me — financial planning for expats; clarity over complexity. CTA to book/contact.
4. Book Club — teaser; "real talk, page by page"; Cologne meetups coming.
5. Life in Germany — landing for that section (links to insights filtered by tag/category).
6. Footer — Legal, Datenschutzerklärung, Contact, social links.

**Tech:** Next.js 16, App Router, Tailwind 4, shadcn/ui (new-york). No auth, no database for MVP. Blog = MDX or markdown files in repo.

**Tone:** Warm, direct, "first chats always free." Like pirateskills.com: confident but approachable.

**Existing content:** Use placeholder copy; real copy from https://www.loganwilliams.com/ can be pasted in later. Match structure and intent, not verbatim.

Start with: homepage layout + 2–3 sample insights in MDX. Make it deployable to Vercel.
```

---

## Deployment

1. **GitHub** — New repo `loganwilliams-website` (or fork and clean).
2. **Vercel** — New project, connect repo, deploy. Custom domain `loganwilliams.com` when ready.
3. **DNS** — Point domain to Vercel when you have it.

---

## Post-MVP (Later)

- Login (Clerk) if you add gated content or newsletter.
- Contact form → n8n or Resend.
- Analytics (optional).

---

## Cleanup Reminder

**After this project is live:** Return to the source project (`my-app`) and remove any Logan-specific data or content you may have copied in by mistake. Keep `my-app` focused on CM / Builder Codex SaaS only.
