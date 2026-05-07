# GABC — Content Model / CMS Choice (Draft)

This decides how events, pages, and posts are edited and published.

## Options

### Option A — MDX in Git (fastest, lowest cost)

**How it works:** content lives as `.md/.mdx` files in the repo; changes go through PRs.

- Pros: simple, cheap, versioned, great for developer-led updates
- Cons: non-technical editors need help (or training) to publish safely
- Best for: board preview + early phase where content changes are infrequent

### Option B — Headless CMS (recommended for non-technical editors)

**How it works:** editors update content in a CMS UI; the site renders it via API.

- Pros: editor-friendly, roles/approvals, scheduled publishing
- Cons: setup time + ongoing subscription; governance required
- Best for: regular event updates, rotating volunteers/staff, avoiding dev bottlenecks

### Option C — Supabase-backed admin UI (most custom)

**How it works:** we build a custom admin dashboard to manage events/posts/pages.

- Pros: full control, unified with member portal later
- Cons: slowest and riskiest; requires ongoing dev maintenance
- Best for: when there are unique workflows a CMS can’t support

## Recommendation

- **Phase 1 (board approval):** Option A (MDX) for speed and simplicity.
- **After approval:** move to Option B if editors are non-technical and updates are weekly.

## Events vs posts

- If GABC needs **weekly event updates**, Option B becomes more valuable.
- If events remain in an external system, Phase 1 can link out and avoid building event CRUD.

