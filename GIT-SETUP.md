# GitHub setup for logans-tools

The local repo is ready. To push to GitHub:

## 1. Create the repo on GitHub

**Option A — Web UI**
1. Go to https://github.com/new
2. Owner: **A-sop** (or your org)
3. Repository name: **logans-tools**
4. Private (or Public)
5. **Do not** add README, .gitignore, or license (we already have them)
6. Click Create repository

**Option B — GitHub CLI** (if installed)
```bash
gh repo create A-sop/logans-tools --private --source=. --remote=origin --description "Logan's tools and projects hub"
```

## 2. Add remote and push

```powershell
cd c:\Dev\logans-tools
git remote add origin https://github.com/A-sop/logans-tools.git
git branch -M main
git push -u origin main
```

(Replace `A-sop` with your org if different.)

## 3. Deploy to Vercel

1. Import **A-sop/logans-tools** at vercel.com/new
2. Deploy
3. Add custom domain **logans.tools** when ready
