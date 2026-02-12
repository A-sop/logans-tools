# Webhook Security Guide

**Purpose:** Security implementation for webhook endpoints (lesson 5.5).  
**Audience:** Developers implementing and maintaining webhook security.

---

## Overview

Webhooks are public URLs that anyone can find and hit. Without security, attackers could:
- **Spam your endpoint** (replay attacks)
- **Send fake data** (spoofing)
- **Overwhelm your system** (DDoS)

This guide implements three security layers:
1. **Rate limiting** — Prevents abuse (10 requests/minute per IP)
2. **API key verification** — Prevents spoofing (X-API-Key header)
3. **Request logging** — Enables monitoring (all attempts logged)

---

## Security Threats

### Replay Attacks

**Problem:** Attacker captures a valid request and resends it multiple times.

**Example:**
- Attacker intercepts: "User Jane submitted positive feedback"
- Attacker replays it 500 times
- Your system processes it 500 times → duplicates, wasted resources

**Solution:** Rate limiting prevents rapid repeated requests.

### Spoofing

**Problem:** Attacker pretends to be n8n and sends fake data.

**Example:**
- Attacker sends: "User submitted feedback: Your app is terrible (negative sentiment)"
- Your system thinks n8n sent it
- Fake negative feedback gets stored → bad product decisions

**Solution:** API key verification ensures only n8n can send valid requests.

### Abuse/DDoS

**Problem:** Attacker floods your endpoint with thousands of requests per second.

**Example:**
- Attacker hits your webhook 10,000 times per second
- Server tries to process all requests
- Database gets overloaded → app becomes slow or crashes

**Solution:** Rate limiting prevents overwhelming your system.

---

## What Needs to Be Secret

### ✅ MUST be in environment variables (never commit to Git):

- `N8N_FEEDBACK_WEBHOOK_URL` — The URL your app calls
- `N8N_WEBHOOK_SECRET` — Shared secret for API key verification
- Any API keys or authentication tokens

### ✅ Can be public (in your code):

- API route paths — `/api/webhooks/n8n/feedback` is fine to have in code
- The structure of your webhook handlers

**Why API route paths don't need to be secret:**

Security through obscurity is weak. API routes are discoverable, and once found, you have zero protection. The real security comes from:
- **API key verification** — Even if attackers know your endpoint, they can't fake requests without your secret key
- **Rate limiting** — Prevents abuse even if someone finds your endpoint
- **Request logging** — Helps you detect and respond to attacks

---

## Implementation

### Rate Limiting

**Configuration:**
- Max requests: 10 per minute per IP
- Time window: 60 seconds
- Storage: In-memory Map (works for single server; use Redis for multi-server)

**How it works:**
1. Track IP address → `{count, resetTime}`
2. If count < 10 within window → allow, increment count
3. If count ≥ 10 within window → block, return 429
4. If time window passed → reset count to 1

**Code location:** `src/app/api/webhooks/n8n/feedback/route.ts`

### API Key Verification

**Configuration:**
- Header name: `X-API-Key`
- Secret stored in: `N8N_WEBHOOK_SECRET` environment variable
- Comparison: Constant-time comparison (prevents timing attacks)

**How it works:**
1. Extract `X-API-Key` header from request
2. Compare to `process.env.N8N_WEBHOOK_SECRET`
3. If match → allow request
4. If no match or missing → return 401 Unauthorized

**Code location:** `src/app/api/webhooks/n8n/feedback/route.ts`

### Request Logging

**Format:**
```
[WEBHOOK] timestamp | IP | status | reason
```

**Examples:**
- `[WEBHOOK] 2025-01-15T10:00:00Z | 192.168.1.1 | SUCCESS | Feedback stored`
- `[WEBHOOK] 2025-01-15T10:00:01Z | 192.168.1.1 | BLOCKED | Rate limit exceeded`
- `[WEBHOOK] 2025-01-15T10:00:02Z | 10.0.0.5 | BLOCKED | Invalid API key`

**What's logged:**
- Timestamp (ISO format)
- IP address
- Status (SUCCESS, BLOCKED, ERROR)
- Reason (specific message)
- Request size (warn if > 100KB)
- User ID (if present)
- Processing time (for successful requests)

**Code location:** `src/app/api/webhooks/n8n/feedback/route.ts`

---

## Setup Instructions

### Step 1: Generate Webhook Secret

```bash
openssl rand -hex 32
```

This generates a 64-character hex string like:
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

### Step 2: Add to Environment Variables

**Local (.env.local):**
```bash
N8N_WEBHOOK_SECRET=your-secret-from-step-1
```

**Vercel:**
1. Go to Vercel dashboard → Your project → Settings → Environment Variables
2. Add `N8N_WEBHOOK_SECRET` with your secret value
3. Apply to: Preview and Production
4. Redeploy if needed

### Step 3: Configure n8n

1. Open your n8n workflow
2. Click the HTTP Request node (webhook callback to your app)
3. In Header Parameters section, add:
   - **Name:** `X-API-Key`
   - **Value:** Your secret from step 1 (paste the actual value)
4. Ensure "Send Headers" is toggled ON
5. Save workflow

**Note:** n8n Cloud doesn't support environment variables, so you must paste the actual secret value. For self-hosted n8n, you can use `{{ $env.N8N_WEBHOOK_SECRET }}`.

---

## Testing

### Test Rate Limiting

```bash
# Send 15 requests quickly
for i in {1..15}; do
  curl -X POST http://localhost:3000/api/webhooks/n8n/feedback \
    -H "Content-Type: application/json" \
    -H "X-API-Key: your-secret" \
    -d '{"test": true}' &
done
wait
```

**Expected behavior:**
- First 10 requests: succeed (200 status)
- Requests 11-15: blocked (429 status)
- Wait 60 seconds and try again → should allow 10 more requests

### Test API Key Verification

**Valid API key:**
```bash
curl -X POST http://localhost:3000/api/webhooks/n8n/feedback \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret" \
  -d '{"test": true}'
```
Expected: 200 OK

**Invalid API key:**
```bash
curl -X POST http://localhost:3000/api/webhooks/n8n/feedback \
  -H "Content-Type: application/json" \
  -H "X-API-Key: wrong-secret" \
  -d '{"test": true}'
```
Expected: 401 Unauthorized

**Missing API key:**
```bash
curl -X POST http://localhost:3000/api/webhooks/n8n/feedback \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```
Expected: 401 Unauthorized

---

## Monitoring

### View Logs

**Local development:**
- Logs appear in terminal where `npm run dev` is running
- Look for `[WEBHOOK]` entries

**Vercel production:**
1. Go to Vercel dashboard → Your project
2. Click "Logs" tab
3. Filter by "webhook" or search for `[WEBHOOK]`

### Suspicious Activity Patterns

Watch for:
- **Many rate limit blocks from same IP** → Possible attack attempt
- **Many invalid API key attempts** → Someone trying to spoof n8n
- **Unusual request sizes** → Possible payload attack
- **Spikes in requests** → Possible DDoS attempt

**If you see suspicious patterns:**
- Block specific IP addresses at the Vercel level
- Add more sophisticated rate limiting
- Consider upgrading to HMAC signature verification (for high-stakes data)

---

## Security Level Assessment

### Current Implementation (Rate Limiting + API Key)

**Appropriate for:**
- ✅ User feedback, form submissions, notifications
- ✅ Low-stakes automation triggers
- ✅ Learning projects and MVPs

### Upgrade to HMAC When Handling:

- ⚠️ Payment processing, financial data
- ⚠️ Sensitive personal information
- ⚠️ Actions that cost money or affect users directly

**HMAC Resources:**
- [n8n Webhook Security Best Practices](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)
- [How HMAC Signing Works (GitHub Webhooks)](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)

---

## Troubleshooting

### Rate Limit Not Working

- Check IP address extraction logic (try different headers)
- Verify rate limit map is being updated
- Check for multiple server instances (in-memory rate limiting only works for single server)

### API Key Verification Failing

- Verify `N8N_WEBHOOK_SECRET` is set in environment variables
- Check that n8n is sending `X-API-Key` header
- Verify header name matches exactly (case-sensitive)
- Check Vercel environment variables are applied to correct environments

### Logs Not Appearing

- Verify `console.log` is being called (check code)
- Check Vercel logs dashboard (may take a few seconds to appear)
- Ensure you're looking at the correct deployment (preview vs production)

---

## Reference

- **Webhook Endpoint:** `src/app/api/webhooks/n8n/feedback/route.ts`
- **Environment Variables:** `.env.example` (template), `.env.local` (your secrets)
- **PRD:** `src/docs/user-feedback/user-feedback-prd.md`
- **n8n Setup:** `src/docs/n8n-setup.md`
