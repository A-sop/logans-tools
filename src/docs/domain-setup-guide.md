# Domain setup guide (Level 4.6)

Step-by-step for connecting a domain you already bought to Vercel and Clerk Production.

---

## 1. Add the domain in Vercel

1. Open [Vercel Dashboard](https://vercel.com/dashboard) → select your **my-app** project.
2. Go to **Settings** → **Domains**.
3. Click **Add** and enter your domain, e.g.:
   - `yourdomain.com` (apex/root), or
   - `www.yourdomain.com` (www), or both.
4. Choose **Production** when asked which environment.
5. Click **Add**.

**If you bought the domain on Vercel:** Vercel will configure DNS. Wait 2–5 minutes, then open `https://yourdomain.com` — you should see your app with SSL.

**If you bought the domain elsewhere** (GoDaddy, Namecheap, Cloudflare, etc.): Vercel will show DNS instructions. Usually:

- **A record:** Host `@` (or leave blank) → Value `76.76.21.21`
- **CNAME (for www):** Host `www` → Value `cname.vercel-dns.com`

Add these in your registrar’s DNS settings. Save, then wait 5–60 minutes (sometimes up to 48 hours). Vercel will issue SSL once DNS propagates.

---

## 2. Clerk Production: keys and domain

1. Open [Clerk Dashboard](https://dashboard.clerk.com/).
2. Switch to **Production** (environment switcher, usually top-left or in the sidebar).
3. **API Keys:** Go to **Configure** → **API Keys** (or **Settings** → **API Keys**). Copy:
   - **Publishable key** (`pk_live_...`)
   - **Secret key** (`sk_live_...`)
   - Store them somewhere safe; you’ll add them to Vercel in step 3.
4. **Domains:** Go to **Configure** → **Domains** (or **Settings** → **Domains**). Add:
   - `https://yourdomain.com`
   - If you use www: `https://www.yourdomain.com`
   - Do **not** add `*.vercel.app` here — that’s for Development/Preview only.
5. **Session token (if not already set):** Go to **Sessions** → **Customize session token**. Ensure your app’s claims are present (e.g. `role`, `publicMetadata` for onboarding). Our PRD uses something like:
   ```json
   {
     "role": "authenticated",
     "metadata": "{{user.public_metadata}}"
   }
   ```
   Save.

---

## 3. Vercel environment variables for Production

1. Vercel → your project → **Settings** → **Environment Variables**.
2. For **Production** only (or add new variables and select Production), set:

| Name | Value | Notes |
|------|--------|--------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_...` | From Clerk Production |
| `CLERK_SECRET_KEY` | `sk_live_...` | From Clerk Production |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` | |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` | |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/workspace` | |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/onboarding` | |
| `SUPABASE_URL` | (same as Preview) | |
| `SUPABASE_SERVICE_ROLE_KEY` | (same as Preview) | |
| `SUPABASE_ANON_KEY` | (same as Preview) | |

3. Save. Redeploy the **Production** deployment (Deployments → … on latest production → Redeploy) so the new variables are used.

---

## 4. Verify

1. Open `https://yourdomain.com` — page loads with SSL (no browser warning).
2. Click **Sign up** → create a test account → complete onboarding → land on workspace.
3. Create some data (e.g. a task in “My tasks”), sign out, sign in again — data still there.
4. Incognito: open `https://yourdomain.com/workspace` → redirect to sign-in → sign in → workspace.

If anything fails, check: Clerk Domains include your exact production URL, Vercel env is Production and redeployed, and DNS has propagated (Vercel Domains page shows a green check when ready).

---

## Reference

- Human to-dos: `src/docs/human-todos.md` (sections 4.6 — Domain and Clerk Production, Vercel environment variables).
- Auth PRD: `src/docs/auth-flow/auth-flow-prd.md`.
