# n8n workflow: Feedback from app

One-time import and configuration for the feedback workflow. One file per workflow feature.

---

## What this workflow does

1. **Webhook** — Receives POST from your app (message, userId, firstName, lastName, email, browser, timestamp, url).
2. **Gmail** — Sends you an email with the feedback (you add your Gmail credential and set the "To" address).
3. **HTTP Request** — POSTs the same payload to your app's callback so feedback is stored in Supabase (`/api/webhooks/n8n/feedback`).
4. **Respond to Webhook** — Returns `{ "received": true }` to the app.

Optional later: add an AI Agent node between Webhook and Gmail to analyze sentiment/category and include that in the callback body.

---

## One-time import

1. In **n8n** (e.g. loganstools.app.n8n.cloud), open the workflow list.
2. **Three dots** (top right) → **Import from File**.
3. Select **`n8n-feedback-workflow-full.json`** from this folder (`scripts/`).
4. The workflow opens with four nodes: **Webhook** → **Gmail** → **HTTP Request (app callback)** → **Respond to Webhook**.

If import fails (e.g. node type or version), see **Fallback** at the end.

---

## After import: configure

1. **Gmail node**  
   - **To** is pre-set to `feedback@logans.tools` (your catchall). Open the node and add your **Gmail OAuth2** credential when ready (Connect account / Sign in with Google).

2. **HTTP Request node**  
   - URL is set to `https://cm.logans.tools/api/webhooks/n8n/feedback`.  
   - For local testing, change it to `http://localhost:3000/api/webhooks/n8n/feedback`.  
   - If you use webhook secret (human-todos 5.5), add a header: **Name** `X-API-Key`, **Value** your `N8N_WEBHOOK_SECRET`.

3. **Activate**  
   - Turn the workflow **On** (toggle top right).  
   - Open the **Webhook** node and copy the **Test URL** or **Production URL**.

---

## Point your app at the webhook

In **`.env.local`** (project root: `c:\Dev\my-app\.env.local`):

```env
N8N_FEEDBACK_WEBHOOK_URL=<paste the URL from the Webhook node>
```

Restart the dev server (`npm run dev`). In the app, use **Give Feedback**, submit a message. You should see a run in n8n **Executions**, an email (if Gmail is configured), and a row in Supabase if the callback URL is correct and the feedback table exists.

---

## Files in this folder

| File | Purpose |
|------|--------|
| **n8n-feedback-workflow-full.json** | Full workflow (Webhook → Gmail → HTTP Request → Respond). Use for one-time import. |
| **n8n-feedback-workflow.json** | Minimal workflow (Webhook → Respond only). Use only if you want to test the connection without Gmail or callback. |
| **n8n-workflow-feedback.md** | This doc. |

---

## Fallback (if import fails)

Create the workflow manually:

1. **Webhook** — Method POST, path `feedback`, response mode "Using 'Respond to Webhook' Node".
2. **Gmail** — Resource Message, operation Send. Set To to `feedback@logans.tools`, Subject, Message (use expressions from webhook body: `$json.body.message`, etc.). Add Gmail OAuth2 credential.
3. **HTTP Request** — Method POST, URL your app callback (e.g. `https://cm.logans.tools/api/webhooks/n8n/feedback`). Body: JSON, expression `{{ JSON.stringify($('Webhook').first().json.body ?? { firstName: 'Anonymous', lastName: '', message: '' }) }}`.
4. **Respond to Webhook** — Respond with JSON `{"received": true}`.
5. Connect in order: Webhook → Gmail → HTTP Request → Respond to Webhook. Save and activate.

See also **`src/docs/human-todos.md`** section **5.4 — Webhook Integration** and **5.5 — Webhook Security**.
