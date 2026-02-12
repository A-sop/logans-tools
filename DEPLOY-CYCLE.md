# From Local Change to Live Website

This guide walks you through one full cycle: edit → commit → push → watch deploy → verify live.

---

## 1. Make a small, visible change

**Done for you:** The hero headline was updated from  
_"Stay Reliable, Compliant, and in Control"_  
to  
_"Tasks Under Control. You Stay in Control."_

**Where it lives:** `src/app/page.tsx` (around line 37).

Save the file (Ctrl+S) if needed.

---

## 2. Commit with a descriptive message

In PowerShell, from your project folder:

```powershell
cd c:\Users\inbox\OneDrive\PS_Projects\my-app
git status
```

You should see `src/app/page.tsx` as modified.

```powershell
git add src/app/page.tsx
git commit -m "Improve hero headline: Tasks Under Control. You Stay in Control."
```

---

## 3. Push to GitHub

```powershell
git push origin main
```

When it finishes, GitHub’s `main` branch has your new commit. Vercel is connected to this repo, so it will start a new deployment automatically.

---

## 4. Watch the deployment in Vercel

1. Open **https://vercel.com/dashboard**
2. Click your project (**my-app** or whatever you named it)
3. Open the **Deployments** tab
4. You should see a **new deployment** at the top (status: Building → then Ready, or Failed if something broke)
5. Click that deployment to see:
   - **Status** (Building / Ready / Error)
   - **Build log** (clone, install, build, deploy)
   - **Duration**
6. When status is **Ready**, the new version is live.

No need to click “Redeploy” — pushing to `main` triggers this automatically.

---

## 5. Verify the change on your live site

1. Wait until the deployment shows **Ready** in Vercel.
2. Open your live URL (e.g. the one you shared, or the main project URL from the Vercel project page).
3. **Hard refresh** so you don’t see a cached version:
   - **Windows:** Ctrl + F5 or Ctrl + Shift + R
   - **Mac:** Cmd + Shift + R
4. Check the hero section: the headline should now say  
   **"Tasks Under Control. You Stay in Control."**

If you see the new headline, the cycle worked end-to-end.

---

## 6. How automatic deployment works

| Step               | What happens                                                           |
| ------------------ | ---------------------------------------------------------------------- |
| You push to `main` | GitHub updates the `main` branch with your commit.                     |
| Vercel notices     | Vercel is wired to your GitHub repo and sees the new commit on `main`. |
| Build starts       | Vercel clones the repo, runs `npm install` and `npm run build`.        |
| Build finishes     | If the build succeeds, Vercel deploys the output to its CDN.           |
| Live site updates  | Your production URL now serves the new version.                        |

So: **push to `main` → Vercel builds and deploys → live site updates.** No manual “Deploy” click needed for normal updates.

**Preview deployments:** If you push to another branch (or open a PR), Vercel creates a _preview_ URL for that branch. Production (your main live URL) only changes when you push to `main`.

---

## Quick reference

- **Change code** → save in Cursor
- **Commit:** `git add -A` → `git commit -m "Description"`
- **Push:** `git push origin main`
- **Watch:** Vercel dashboard → Project → Deployments
- **Verify:** Open live URL, hard refresh, check the change

You’ve now seen the full cycle from local change to live website.
