# n8n Workflow Setup Guide

**Purpose:** Step-by-step guide for setting up n8n workflows with AI analysis for feedback processing (lesson 5.2).  
**Audience:** Developers setting up the feedback automation workflow.

---

## Overview

n8n is a workflow automation tool that connects your app to hundreds of services without writing backend code. For feedback processing, we'll build:

**Chat Trigger → AI Tools Agent → Structured Output Parser → Auto-fixing Output Parser → Gmail**

This workflow:
1. Receives feedback (via chat trigger for testing, webhook in production)
2. Analyzes it with an AI agent (sentiment, category, priority)
3. Returns structured JSON data
4. Sends formatted email notifications

---

## Prerequisites

- n8n Cloud account (free tier available)
- OpenRouter account (free models available)
- Gmail account (or alternative: Slack, Discord, Microsoft Teams)

---

## Step 1: Create n8n Account

1. Go to [n8n.io](https://n8n.io)
2. Click "Sign up" and create your account
3. Choose the **Cloud** option (no installation needed)
4. Complete the onboarding flow

---

## Step 2: Basic Workflow (Chat → Gmail)

### 2.1 Add Chat Trigger

1. In n8n, click "Add node"
2. Search for "Chat" and select **Chat Trigger**
3. This lets you manually trigger the workflow by typing a message (no webhook URL needed yet)

### 2.2 Add Gmail Node

1. Click the **+** icon on the Chat Trigger node
2. Search for "Gmail" and select it
3. Authorize with your Gmail account (follow OAuth flow)
4. Configure the node:
   - **Action:** "Send Email"
   - **To:** `feedback@yourdomain.com` (or your email)
   - **Subject:** `New Feedback Received`
   - **Body:** Include the feedback message from chat (reference: `{{ $json.chatInput }}` or similar)

### 2.3 Test Basic Workflow

1. Click **Test** button in n8n
2. In the chat input, paste example feedback:
   ```
   I've been using the dashboard for a week now and I keep running into the same problem. When I click "Export Report," the button doesn't clearly show what's happening. There's no loading spinner or confirmation message, so I can't tell if my click registered or if it's processing.
   ```
3. Check your email — you should receive the feedback notification
4. View execution log in n8n to see data flow

---

## Step 3: Add AI Tools Agent

### 3.1 Insert AI Agent Node

1. Click **between** Chat Trigger and Gmail nodes
2. Search for "AI Agent" and select it
3. Choose **"Tools Agent"** as the type
4. Your workflow now: `Chat Trigger → AI Agent → Gmail`

### 3.2 Connect Chat Input

1. Click on the AI Agent node
2. In the "Prompt" or "Text" field, reference the chat input:
   - Use expression: `{{ $json.chatInput }}` (exact field name depends on Chat Trigger output)
   - Check execution log from Step 2 to see the exact field name

### 3.3 Configure System Message

1. In AI Agent node, click **"Add Option"**
2. Select **"System Message"**
3. Enter:
   ```
   You are a feedback analysis assistant. Analyze user feedback and provide a brief summary of the sentiment and type of feedback.
   ```

**Note:** This won't work yet — the AI Agent needs a language model. That's next.

---

## Step 4: Set Up OpenRouter

### 4.1 Create OpenRouter Account

1. Go to [OpenRouter.ai](https://OpenRouter.ai)
2. Click "Sign up" and create account (free)
3. After logging in, go to **API Keys** section
4. Click **"Create Key"** and name it (e.g., "n8n workflow")
5. Copy your API key and save securely

**Free models available:** You don't need credits to start. Browse [free models](https://openrouter.ai/models?order=newest&max_price=0).

### 4.2 Add OpenRouter Credentials to n8n

1. In n8n workflow, bottom left → **"Credentials"**
2. Click **"Create new credential"**
3. Search for **"OpenRouter"** and select it
4. Paste your API key in the **"API Key"** field
5. Click **"Save"**

### 4.3 Connect OpenRouter to AI Agent

1. Go back to workflow, click on **AI Agent** node
2. Find **"Model"** section
3. Click **"Add Model"** → Select **"OpenRouter Chat Model"**
4. Select your OpenRouter credentials from dropdown
5. Choose a model:
   - For free testing: `meta-llama/llama-3.2-3b-instruct:free` or any model with `:free` suffix
   - Browse all free models: [OpenRouter Free Models](https://openrouter.ai/models?order=newest&max_price=0)

### 4.4 Test AI Agent

1. Click **"Test workflow"** in n8n
2. Send feedback example from Step 2
3. Check email — you should receive AI-analyzed feedback
4. Check execution log to see AI Agent output

---

## Step 5: Structured Output Parsing

### 5.1 Update System Message for JSON Output

Replace the AI Agent system message with this strict version:

```
You are a feedback analysis assistant. Analyze user feedback and return ONLY valid JSON with no additional text or commentary.

CRITICAL: Your response must be valid JSON that can be parsed. No markdown code blocks, no explanations, no extra text before or after the JSON.

Always respond with valid JSON in this exact format:
{
  "sentiment": "positive" | "negative" | "neutral",
  "category": "bug" | "feature_request" | "question" | "other",
  "priority": "low" | "medium" | "high",
  "summary": "one sentence summary of the feedback",
  "actionable": true | false
}

Sentiment rules:
- Positive: user is happy, satisfied, praising
- Negative: user is frustrated, reporting problems, complaining
- Neutral: general feedback, suggestions, questions

Priority rules:
- High: blocks user workflow, frequently mentioned issues, critical functionality
- Medium: useful improvement, nice-to-have feature, minor bugs
- Low: minor issue, edge case, cosmetic problem

Category rules:
- bug: something is broken or not working as expected
- feature_request: user wants new functionality or improvements
- question: user is asking for help or clarification
- other: feedback that doesn't fit other categories

Remember: Respond ONLY with the JSON object. Nothing else.
```

### 5.2 Add Structured Output Parser

1. Click **+** icon **after** the AI Agent node
2. Search for **"Structured Output Parser"** (part of LangChain nodes)
3. Add it to workflow: `Chat Trigger → AI Agent → Structured Output Parser → Gmail`
4. Configure parser:
   - Click on Structured Output Parser node
   - Under **"Schema"**, paste JSON example:
     ```json
     {
       "sentiment": "positive",
       "category": "bug",
       "priority": "high",
       "summary": "one sentence summary",
       "actionable": true
     }
     ```
   - Enable **"Parse Output"** option
   - Connect AI Agent's text output as input

### 5.3 Add Auto-fixing Output Parser

1. After Structured Output Parser, click **+** icon
2. Search for **"Auto-fixing Output Parser"** (LangChain nodes)
3. Add to workflow: `Chat Trigger → AI Agent → Structured Parser → Auto-fixing Parser → Gmail`
4. Configure:
   - Click on Auto-fixing Output Parser node
   - Set **Base Parser** to your Structured Output Parser
   - Configure **Retry LLM**:
     - Click **"Add LLM"** → Select OpenRouter credentials
     - Choose model (can use same or different than AI Agent)
     - Set **"Max Retries"** to 1 or 2

**How it works:**
- Structured Parser tries to extract JSON from AI Agent output
- If parsing succeeds → data flows to Gmail ✅
- If parsing fails → Auto-fixing Parser uses retry LLM to fix JSON → flows to Gmail ✅

### 5.4 Update Gmail Node for Structured Data

1. Click on **Gmail** node
2. Find **"Options"** → Click **"Add Option"**
3. Select **"Email Type"** → Set to **"HTML"**
4. Update **Subject:**
   ```
   Feedback Analysis: {{$json.sentiment}} {{$json.priority}}
   ```
5. Update **Body** with HTML (paste this):
   ```html
   <h2>📝 Feedback Received</h2>
   <p><strong>Original:</strong></p>
   <blockquote style="background: #f5f5f5; padding: 10px; border-left: 4px solid #999;">
     {{ $json.chatInput }}
   </blockquote>

   <hr>

   <h2>🤖 AI Analysis</h2>
   <table style="width: 100%; border-collapse: collapse;">
     <tr style="background: #f9f9f9;">
       <td style="padding: 8px; border: 1px solid #ddd;"><strong>Sentiment:</strong></td>
       <td style="padding: 8px; border: 1px solid #ddd;">{{ $json.sentiment }}</td>
     </tr>
     <tr>
       <td style="padding: 8px; border: 1px solid #ddd;"><strong>Category:</strong></td>
       <td style="padding: 8px; border: 1px solid #ddd;">{{ $json.category }}</td>
     </tr>
     <tr style="background: #f9f9f9;">
       <td style="padding: 8px; border: 1px solid #ddd;"><strong>Priority:</strong></td>
       <td style="padding: 8px; border: 1px solid #ddd;">{{ $json.priority }}</td>
     </tr>
     <tr>
       <td style="padding: 8px; border: 1px solid #ddd;"><strong>Summary:</strong></td>
       <td style="padding: 8px; border: 1px solid #ddd;">{{ $json.summary }}</td>
     </tr>
     <tr style="background: #f9f9f9;">
       <td style="padding: 8px; border: 1px solid #ddd;"><strong>Actionable:</strong></td>
       <td style="padding: 8px; border: 1px solid #ddd;">{{ $json.actionable ? '✅ Yes' : '❌ No' }}</td>
     </tr>
   </table>

   <hr>

   <p style="font-size: 12px; color: #666;">
     This analysis was generated automatically. Please review for accuracy before taking action.
   </p>
   ```

**Note:** Adjust `{{ $json.chatInput }}` if your Chat Trigger uses a different field name.

---

## Step 6: Test with Multiple Feedback Types

Test your workflow with these examples:

### Test 1: Positive Feedback
```
Just wanted to say the new onboarding flow is fantastic! The step-by-step guidance is clear and I was able to set up my account in less than 5 minutes. The explanations for each setting are really helpful, and the progress indicator at the top shows me exactly where I am in the process. Great work on this!
```
**Expected:** sentiment: `positive`, priority: `low`

### Test 2: Bug Report (Negative)
```
I've been using the dashboard for a week now and I keep running into the same problem. When I click "Export Report," the button doesn't clearly show what's happening. There's no loading spinner or confirmation message, so I can't tell if my click registered or if it's processing. I've clicked it 3 times thinking it didn't work, and now I have 3 export jobs running. This is really frustrating and wastes my time.
```
**Expected:** sentiment: `negative`, category: `bug`, priority: `high`

### Test 3: Feature Request (Neutral)
```
It would be nice to have keyboard shortcuts for common actions. I'm a power user and navigating with the mouse slows me down.
```
**Expected:** sentiment: `neutral`, category: `feature_request`, priority: `medium`

**Verify:**
- ✅ Structured fields appear correctly in email
- ✅ Sentiment matches feedback tone
- ✅ Priority makes sense for issue severity
- ✅ Summary captures main point
- ✅ HTML table renders properly

---

## Troubleshooting

### AI Agent Returns Non-JSON
- Try a more capable model (GPT-4 or Claude with $10 OpenRouter credit)
- Refine system message with more examples
- Check Auto-fixing Parser logs — it should correct malformed JSON

### Parsing Errors
- Check execution logs for each node
- Verify schema matches expected structure exactly
- Ensure Auto-fixing Parser has retry LLM configured

### Email Not Received
- Check Gmail authorization (re-authorize if needed)
- Verify email address in Gmail node
- Check n8n execution logs for errors

---

## Next Steps

**Lesson 5.3:** Mobile responsive design for feedback form  
**Lesson 5.4:** Replace Chat Trigger with Webhook, connect app to n8n, store feedback in Supabase

---

## Reference

- **n8n Docs:** [n8n Documentation](https://docs.n8n.io/)
- **AI Tools Agent:** [n8n AI Tools Agent Docs](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-langchain.aitoolsagent/)
- **OpenRouter:** [OpenRouter Models](https://openrouter.ai/models)
- **Structured Outputs:** [n8n Structured Outputs](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-langchain.structuredoutputparser/)
