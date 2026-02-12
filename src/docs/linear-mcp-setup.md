# Linear MCP Setup Guide

**Purpose:** Connect Cursor AI to your Linear workspace so I can create issues, update tasks, and manage your project backlog.  
**Audience:** Developers setting up Linear integration with Cursor.

---

## What is MCP?

MCP (Model Context Protocol) allows Cursor to connect to external services like Linear. Once configured, I can:
- List and create Linear issues
- Update issue status, assignees, labels
- Create projects and milestones
- Search documentation
- Manage attachments and comments

---

## Prerequisites

- Linear workspace account (free tier works)
- Cursor IDE installed
- Access to Cursor settings

---

## Step 1: Get Your Linear API Key

1. **Go to Linear:** Open [linear.app](https://linear.app) and sign in to your workspace
2. **Navigate to Security Settings:**
   - Go directly to: `https://linear.app/USERNAME/settings/account/security` (replace `USERNAME` with your Linear username)
   - Or: Click your profile icon (bottom left) → **Settings** → **Security & Access** → **API Keys**
3. **Create Personal API Key:**
   - Click **"Create API Key"** or **"New API Key"**
   - Give it a name (e.g., "Cursor AI")
   - Copy the API key immediately (you won't see it again!)

**Important:** The API key looks like `lin_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`. Save it securely.

**Note:** The organization-level API settings page (`/settings/api`) is for managing OAuth apps and webhooks. Your personal API keys are in your account security settings.

---

## Step 2: Configure MCP Server in Cursor

1. **Open Cursor Settings:**
   - Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
   - Type "Preferences: Open User Settings (JSON)"
   - Or go to: **File** → **Preferences** → **Settings** → Click the `{}` icon (top right)

2. **Add MCP Server Configuration:**

   Add this to your `settings.json`:

   ```json
   {
     "mcpServers": {
       "Linear": {
         "command": "npx",
         "args": [
           "-y",
           "@modelcontextprotocol/server-linear"
         ],
         "env": {
           "LINEAR_API_KEY": "your-api-key-here"
         }
       }
     }
   }
   ```

   **Replace `your-api-key-here`** with the API key you copied from Step 1.

3. **Save and Restart:**
   - Save the settings file (`Ctrl+S` / `Cmd+S`)
   - **Restart Cursor** completely (close and reopen)

---

## Step 3: Verify Connection

After restarting Cursor, I should be able to:

1. **List your teams:**
   ```
   Can you list my Linear teams?
   ```

2. **List issues:**
   ```
   Show me my open Linear issues
   ```

3. **Create an issue:**
   ```
   Create a Linear issue titled "Test connection" in my team
   ```

If these work, the connection is successful! ✅

---

## Troubleshooting

### "Server 'Linear' not found" Error

- **Check settings.json:** Make sure the MCP server configuration is correct
- **Restart Cursor:** Fully close and reopen Cursor (not just reload window)
- **Check API key:** Verify the key is correct and hasn't expired
- **Check npm/npx:** Ensure Node.js and npm are installed (`node -v`, `npm -v`)

### API Key Not Working

- **Regenerate key:** Go back to `https://linear.app/USERNAME/settings/account/security` → Delete old key → Create new one
- **Check permissions:** Ensure your Linear user has permission to create/edit issues
- **Verify workspace:** Make sure you're using the correct workspace

### MCP Server Not Starting

- **Check Node.js:** Ensure Node.js 18+ is installed
- **Check npx:** Try running `npx -y @modelcontextprotocol/server-linear` in terminal
- **Check Cursor logs:** View → Output → Select "MCP" from dropdown

---

## Security Notes

- **Never commit your API key** to Git
- The API key is stored in Cursor's user settings (local to your machine)
- If you share your settings.json, remove the `LINEAR_API_KEY` value first
- You can revoke API keys anytime in Linear Settings → API

---

## What I Can Do Once Connected

Once Linear MCP is configured, I can help you:

- ✅ **Create issues** from your human-todos.md checklist items
- ✅ **Update issue status** when work is complete
- ✅ **Link commits** to Linear issues (using issue IDs in commit messages)
- ✅ **Search Linear docs** for feature information
- ✅ **Manage projects** and milestones
- ✅ **Create comments** and attachments on issues

---

## Next Steps

After setup:
1. Test the connection (see Step 3)
2. I can help migrate tasks from `src/docs/human-todos.md` to Linear issues
3. Set up GitHub integration in Linear (optional) to link commits automatically

---

## Reference

- **Linear API Docs:** [https://developers.linear.app/docs](https://developers.linear.app/docs)
- **MCP Documentation:** [https://modelcontextprotocol.io](https://modelcontextprotocol.io)
- **Cursor MCP Setup:** [Cursor MCP Docs](https://docs.cursor.com/mcp)
