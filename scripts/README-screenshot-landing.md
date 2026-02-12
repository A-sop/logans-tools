# Landing page screenshot

The Concierge section on logans.tools displays a screenshot of the CM landing page.

## First-time setup

```bash
npx playwright install chromium
```

## Update the screenshot

**Local:**
```bash
npm run screenshot:landing
```
Saves to `public/cm-landing.png`. Set `LANDING_PAGE_URL` in `.env.local` to override (default: https://cm.logans.tools).

**GitHub Action (automatic):**
- Runs every **Sunday at 08:00 UTC**
- Or trigger manually: Actions → "Screenshot landing page" → Run workflow
- Commits the new screenshot if it changed (with `[skip ci]` to avoid loops)

**Override URL:** Repo Settings → Secrets and variables → Actions → Variables → add `LANDING_PAGE_URL` (e.g. `http://localhost:3000` for local testing).
