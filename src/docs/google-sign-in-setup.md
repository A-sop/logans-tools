# Enable Google sign-in (Clerk)

Step-by-step: get the redirect URI from Clerk, create Google OAuth credentials, then paste them back into Clerk.

---

## Part 1 — Clerk: Turn on Google and copy the redirect URI

1. Open **[Clerk Dashboard](https://dashboard.clerk.com)** and select your application.
2. Switch to **Production** (top or sidebar) if your live site is at https://cm.logans.tools.
3. In the left sidebar go to **User & Authentication** → **Social connections** (or **Sign-in options** → **Social**).
4. Find **Google** and click it (or **Add connection** → Google).
5. Turn **on**:
   - **Enable for sign-up and sign-in**
   - **Use custom credentials** (so you can paste your own Client ID and Secret).
6. Clerk will show a box labeled something like **Authorized redirect URI** or **Redirect URI** with a URL like:
   - `https://your-clerk-domain.clerk.accounts.dev/v1/oauth_callback`
   - or `https://accounts.clerk.com/...`
7. **Copy that full URL** and keep it — you need it for Google in Part 2.
8. Leave the **Client ID** and **Client secret** fields empty for now. Click **Save** (if needed) and leave the page open.

---

## Part 2 — Google Cloud: Create OAuth credentials

1. Open **[Google Cloud Console](https://console.cloud.google.com)** and sign in with the Google account you use for development.
2. **Create or pick a project:**
   - Top bar: click the project name (e.g. "My Project").
   - Click **New Project** → give it a name (e.g. "My App Auth") → **Create**, then select it.
3. **OAuth consent screen (required once):**
   - Left menu: **APIs & Services** → **OAuth consent screen**.
   - If asked, choose **External** (so any Google user can sign in) → **Create**.
   - **App name:** e.g. "My App" or your app name.
   - **User support email:** your email.
   - **Developer contact:** your email.
   - **Save and Continue** through Scopes (default is fine) and Test users (optional). **Back to Dashboard**.
4. **Create OAuth client:**
   - Left menu: **APIs & Services** → **Credentials**.
   - **+ Create credentials** → **OAuth client ID**.
   - **Application type:** **Web application**.
   - **Name:** e.g. "Clerk My App".
   - **Authorized redirect URIs:** click **+ Add URI** and paste **exactly** the redirect URI you copied from Clerk in Part 1 (e.g. `https://….clerk.accounts.dev/v1/oauth_callback`). Do not add a trailing slash unless Clerk’s URL has one.
   - (Optional) **Authorized JavaScript origins:** add your app’s origins, e.g.:
     - `https://cm.logans.tools`
     - `http://localhost:3000` if you test locally.
   - Click **Create**.
5. **Copy the credentials:**
   - A popup shows **Client ID** (long string ending in `.apps.googleusercontent.com`) and **Client secret**.
   - Copy **Client ID** and **Client secret** (or leave the tab open).

---

## Part 3 — Clerk: Paste Client ID and Client secret

1. Go back to **Clerk Dashboard** → **User & Authentication** → **Social connections** → **Google**.
2. Paste the **Client ID** from Google into the Clerk field.
3. Paste the **Client secret** from Google into the Clerk field.
4. Click **Save** (or **Apply**).

---

## Part 4 — Test

1. Open your app (e.g. https://cm.logans.tools) in an **incognito** window.
2. Go to **Sign up** (or Sign in).
3. Click **Sign in with Google** (or **Continue with Google**).
4. You should see Google’s consent screen, then be redirected back to your app and be signed in.

If you see **"Access blocked: Missing required parameter: client_id"**, the Client ID is not set in Clerk or the wrong environment (Development vs Production) is selected. Check that you’re in the same Clerk environment (e.g. Production) as the site you’re testing.
