# What's next — agent guidance

Use this file to orient AI agents on current priorities and open tasks.

## Current focus

**Level 5.5 Webhook Security** — Webhook integration complete (5.4). Now securing webhook endpoint with rate limiting and API key verification. Human tasks: generate webhook secret, configure n8n to send API key, test rate limiting and API key verification, verify logging (see `src/docs/human-todos.md` section 5.5).

## Human dev to-dos

**Single file:** `src/docs/human-todos.md` — Auth (4.5, 4.6), Level 5, loose ends.

## Linear

When working on Linear issues, include the issue ID in commit messages (e.g. `fix: onboarding loop. Fixes A-XX`). See `GIT-WORKFLOW.md`.

## Cost estimates

Use **average productivity** for new estimates. See `private/cost-estimate-reference.md` (gitignored).

## Key docs

- `CHAT-PRIMER.md` (project root) — New chat / "I'm back" / "I'm done for the day"
- `src/docs/PROJECT-VALUE.md` — Total project value (German/European average Arbeiterbelastung; rate in `private/cost-estimate-reference.md`, €52/hr), optional value log
- `src/docs/human-todos.md` — All human dev to-dos (one file)
- `src/docs/n8n-setup.md` — n8n workflow setup guide (lesson 5.2)
- `src/docs/mobile-responsive-testing.md` — Mobile responsive testing guide (lesson 5.3)
- `src/docs/user-feedback/user-feedback-prd.md` — User Feedback System PRD (lesson 5.4)
- `src/docs/webhook-security.md` — Webhook security guide (lesson 5.5)
- `src/docs/letter-generation/letter-generation-prd.md` — Letter Generation Tool feature (planning, includes insurance cancellations)
- `src/docs/auth-flow/auth-flow-prd.md` — Auth implementation plan
- `src/docs/workspace-prd.md` — Workspace feature
- `GIT-WORKFLOW.md` — Branching, commits, PRs
