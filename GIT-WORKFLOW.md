# Git workflow for this project

**Vercel deploys from the `main` branch.** So your fixes must be on `main` and pushed to GitHub.

---

## PR-based workflow (recommended)

Ship changes using a simple, repeatable workflow:

1. **Branch from main** — Create a feature branch; main stays deployable.
2. **Make small Conventional Commits** — Cursor crafts messages by copying recent style (`feat(scope): summary`, `fix:`, `docs:`, etc.).
3. **Open a PR** — Use Vercel Preview to review before merging.
4. **Squash-merge and sync main** — One clean commit on main; delete the branch.

Protect `main` so it only changes through PRs. This is enough to collaborate effectively on GitHub with Next.js + Vercel.

**References**

- [GitHub Flow](https://docs.github.com/en/get-started/quickstart/github-flow)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Vercel Preview Deployments](https://vercel.com/docs/deployments/preview-deployments)
- [GitHub Protected Branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches)

---

## Linear (optional)

When working on a Linear issue, include the issue ID in your commit message. Linear connects to GitHub and will link the commit and update the issue.

**Format:** Mention the ID anywhere in the message.

```
feat: add signup page A-7
fix: correct redirect after login. Fixes A-7
```

**Issue IDs** (e.g. A-5, A-7) are shown in Linear at the top of each issue. See [project-links](src/docs/project-links.md) for your Linear workspace.

---

## Simple workflow (direct to main)

For quick fixes when you skip PRs. Prefer the PR workflow above for features.

**1. Make sure you're on main**

```powershell
git checkout main
```

**2. Pull latest (in case you edited on another machine)**

```powershell
git pull origin main
```

**3. Make your code changes** (in Cursor, save with Ctrl+S)

**4. Stage, commit, push**

```powershell
git add -A
git status
git commit -m "Short description of what you did"
git push origin main
```

**5. Check**

- GitHub: https://github.com/A-sop/my-app — latest commit should be the one you just pushed
- Vercel will auto-deploy that commit (or click Redeploy in Vercel dashboard)

---

## If you're on a different branch (e.g. button-props-merge)

**Option A: Merge your branch into main, then push main**

```powershell
git checkout main
git merge button-props-merge
git push origin main
```

**Option B: Switch to main and leave the branch for later**

```powershell
git checkout main
```

(Your branch stays there; main is what Vercel builds.)

---

## Quick checks

**Which branch am I on?**

```powershell
git branch
```

The one with `*` is current.

**Did my push reach GitHub?**

```powershell
git log origin/main -1 --oneline
```

That’s the commit GitHub’s main has. After `git push origin main`, your latest commit should match this.

**What will Vercel build?**
Whatever commit is at **main** on GitHub: https://github.com/A-sop/my-app (see the commit hash on the main branch).
