# SEO Checklist — loganwilliams.com

Technical and on-page SEO. Tick as implemented.

---

## Technical

- [x] `robots.ts` — allow `/`, disallow `/workspace/`, `/api/`, `/private/`; sitemap URL
- [x] `sitemap.ts` — homepage, insights index, pillar pages; add per-post URLs when blog exists
- [ ] Root `metadata` — title template, default description, Open Graph base
- [ ] Per-route `generateMetadata` — especially for insights
- [ ] Canonical URLs — absolute, consistent
- [ ] `lang` attribute on `<html>` — `en` or `en`/`de` if bilingual
- [ ] Schema: Person (homepage)
- [ ] Schema: BlogPosting (each post)
- [ ] Schema: ProfessionalService (work-with-me)

---

## On-Page (Content)

- [ ] One primary keyword per post
- [ ] Meta description from excerpt (≤155 chars)
- [ ] H1 = page title (one per page)
- [ ] H2/H3 for structure
- [ ] Internal links to pillar + related posts
- [ ] Links to other projects, communities, Pirate Skills
- [ ] Single author (no author bio block on every post — it's just Logan)

---

## Ongoing

- [ ] Internal linking as new posts are published
- [ ] Keyword doc updated when adding clusters
- [ ] Content map updated when adding posts
