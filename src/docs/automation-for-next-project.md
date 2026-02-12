# Automation for Next Project

**Purpose:** Scripts and commands that replace manual steps. Copy this setup when duplicating the project.

---

## Project siloing (keep each app in its own silo)

When you spin up a **new project** from this template, create **new resources** for each integration. Reuse your existing accounts (Clerk, Stripe, Supabase, n8n) but create new **applications/projects/workspaces** so data stays isolated.

| Integration | Create new | Keeps siloed |
|-------------|------------|--------------|
| **Clerk** | New Application (same dashboard) | Users, sessions, webhooks per app |
| **Supabase** | New Project (same org) | Database, auth, RLS per app |
| **Stripe** | New Products/Prices, or separate Stripe account per business | Customers, subscriptions per app |
| **n8n** | New Workspace, or separate workflows with distinct webhooks | Feedback flows, automation per app |
| **Vercel** | New Project (linked to new repo or branch) | Deployments, env vars per app |

**Only share data across projects when you explicitly request it.** Default is full silo.

---

## npm scripts (add to package.json)

```json
{
  "scripts": {
    "env:check": "node scripts/check-env-keys.js",
    "setup": "node scripts/setup-env.js && npm run env:check",
    "db:push": "npx supabase db push",
    "n8n:test": "tsx scripts/test-n8n-webhook.ts",
    "webhook:test": "tsx scripts/send-clerk-webhook.ts",
    "check": "npm run lint && npm test"
  }
}
```

**DevDependency:** `tsx` (for n8n:test, webhook:test)

---

## Scripts to copy

| Script | Purpose |
|--------|---------|
| `scripts/setup-env.js` | Copy .env.example → .env.local if missing |
| `scripts/check-env-keys.js` | Verify required env vars are set (update required/optional per project) |
| `scripts/test-n8n-webhook.ts` | POST test payload to N8N_FEEDBACK_WEBHOOK_URL |
| `scripts/send-clerk-webhook.ts` | Send signed Clerk billing webhook (payment projects) |

---

## Typical setup flow (new project)

1. **Create new silos** (Clerk Application, Supabase Project, n8n workspace/workflows, etc.) — see table above.
2. **Clone and install:**
```bash
git clone <repo> && cd <project>
npm install
npm run setup          # Creates .env.local from .env.example; runs env:check
```
3. **Edit .env.local** with keys from the **new** resources (not copied from another project).
4. **Verify and run:**
```bash
npm run env:check
npm run dev
```

---

## Before commit / PR

```bash
npm run check          # lint + test
```

Or add to CI: `.github/workflows/ci.yml` (already in this project).

---

## Per-project customizations

- **check-env-keys.js:** Adjust `required` and `optional` arrays for your integrations (Clerk, Supabase, n8n, OpenAI, etc.). Update when adding payment (CLERK_WEBHOOK_SECRET), n8n (N8N_*), etc.
- **.env.example:** Keep in sync with check-env-keys; add new vars when you add integrations.

---

## Manual steps (cannot automate)

- Creating Clerk/Stripe/Supabase/n8n accounts
- Copying API keys from dashboards into .env.local
- Running `supabase link` (one-time, if using remote Supabase)
- Configuring webhooks in Clerk/n8n dashboards
- Browser-based E2E (sign up, checkout, etc.)
