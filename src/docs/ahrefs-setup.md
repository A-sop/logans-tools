# Ahrefs API Setup

**Status:** Deferred. API requires $500+/mo; no free tier. See [SEO-BACKLOG.md](./seo/SEO-BACKLOG.md) for alternatives and when to revisit.

**Purpose:** SEO keyword research, site metrics. Integrate Ahrefs data into `SEO-KEYWORDS.md` and content planning.

---

## 1. Get an API Key

1. Log in to [Ahrefs](https://app.ahrefs.com)
2. Go to **Account Settings → API keys** — [direct link](https://app.ahrefs.com/account/api-keys)
3. Create a new API key
4. Add to `.env.local`:
   ```
   AHREFS_API_KEY=your_key_here
   ```

---

## 2. Eligibility

| Plan | Access |
|------|--------|
| **Enterprise** | Full API access, all keywords and domains |
| **Other plans** | Free test queries only — use `ahrefs.com` or `wordcount.com` as targets |

Free test queries don't consume API units. Use them to verify your key works.

---

## 3. Base URL (if needed)

The default base URL is `https://api.ahrefs.com/v3`. If you get 404 or connection errors:

1. Open any report in the Ahrefs dashboard (e.g. Keywords Explorer)
2. Click the **API** button (shows cURL)
3. Copy the base URL from the request
4. Add to `.env.local`:
   ```
   AHREFS_API_BASE=https://your-actual-base-url
   ```

---

## 4. Test the Connection

```bash
npx tsx scripts/ahrefs-test.ts
```

- **Subscription info** — Verifies key; doesn't consume units
- **Keyword metrics** — Uses free test target (`ahrefs.com`) on non-Enterprise plans

---

## 5. What’s Useful for loganwilliams.com

| Endpoint | Use |
|----------|-----|
| **Keywords Explorer → Metrics** | Volume, difficulty for your pillar keywords |
| **Keywords Explorer → Ideas** | Matching terms, related terms, search suggestions |
| **Site Explorer** | Domain metrics when the site is live |
| **Subscription info** | Check remaining API units |

---

## 6. Syncing to SEO-KEYWORDS.md

Once the API works, you can:

- Add a script to fetch metrics for keywords in `src/docs/seo/SEO-KEYWORDS.md`
- Populate volume and difficulty columns
- Run periodically to refresh data

(Implement when ready.)

---

## 7. Costs

- Each request consumes **API units** (except subscription info, Site Audit, Rank Tracker, Public)
- Minimum 50 units per request
- Enterprise plans include units; excess is pay-as-you-go
- Free test queries use `ahrefs.com` / `wordcount.com` only — no charge

---

## References

- [API v3 Introduction](https://docs.ahrefs.com/docs/api/reference/introduction)
- [Free test queries](https://docs.ahrefs.com/docs/api/reference/free-test-queries)
- [API keys](https://docs.ahrefs.com/docs/api/reference/api-keys-creation-and-management)
