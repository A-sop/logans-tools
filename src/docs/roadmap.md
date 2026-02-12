# Builder Codex — Product Roadmap

Reference for AI agents and developers. Copy relevant sections into new chats to resume context.

**Pillars:** Product (Value) · Tooling (Power) · Design (Style) · Systems (Scalability) · Security (Safety) · Shipping (Speed)

---

## Level 1 — Get your idea live

A simple site online, code saved, local setup working, a clear goal, and basic safety.

| Step | Topic | Description |
|------|-------|-------------|
| 1.1 | Your Idea | Develop an idea into a concept that helps the AI understand the user's problem you want to solve |
| 1.2 | Local Setup | Install Cursor, learn to use it, get Next.js running locally |
| 1.3 | Landing Page | Work with professional UI libraries (e.g. Magic UI) so your landing page starts in style |
| 1.4 | Fixing Errors | Learn to deal with errors and warnings the AI produces during development |
| 1.5 | Safety First | Learn the most important rules to keep your system and web app safe from harm |
| 1.6 | Going Live | Save code on GitHub and host your landing page on Vercel so you can start sharing it |

---

## Level 2 — Ship your first feature

A tiny plan, clean UI, clear build workflow, checked inputs, and tidy code.

| Step | Topic | Description |
|------|-------|-------------|
| 2.1 | First Features | Turn your concept into a PRD — a todo list for the AI and a chance for you to review it |
| 2.2 | Cursor Agent | Leverage Cursor's agent mode and understand which models to use to build features |
| 2.3 | UI Components | Work with UI components from shadcn/ui to make your first feature look professional |
| 2.4 | Real Functions | Build real functionality for users and connect it to UI components in the frontend |
| 2.5 | Zero Trust | Never trust user input — validate and sanitize everything to prevent XSS and SQL injection |
| 2.6 | Debugging Flow | Format code and detect errors with Prettier and ESLint |

---

## Level 3 — Store your data

Plan features, give AI helpful rules, consistent styles, saved data, safe access, and reviewed changes.

| Step | Topic | Status | Description |
|------|-------|--------|-------------|
| 3.1 | Feature Planning | ✅ | Prioritize essential features, scope to realistic size |
| 3.2 | Cursor Rules | ✅ | Create rules for product and tech stack context |
| 3.3 | Style Systems | ✅ | Use style definitions for a themed look; understand Tailwind basics |
| 3.4 | Saving Data | 🔄 | Store and retrieve data in Supabase; modern patterns, secure server-side operations |
| 3.5 | Database Security | — | Assess and improve security using Supabase Security Advisor |
| 3.6 | Git Workflow | — | Build features in branches, create PRs, merge to production |

---

## Level 4 — Manage user accounts

Planned sprints, smooth onboarding, powerful tools, sign-in + sign-up, preview vs live sites.

| Step | Topic | Description |
|------|-------|-------------|
| 4.1 | Sprint Planning | Manage a productive week with new features and bug fixes in Linear |
| 4.2 | MCP Server | Enhance AI with external tools through MCP for more context |
| 4.3 | User Flow | Design UX from onboarding to making the app easy to use |
| 4.4 | Login & Signup | Let users sign up and log in with email + password or Google; manage profile |
| 4.5 | Auth Security | Ensure users are who they say they are and can only do what they're allowed |
| 4.6 | Preview & Production | Configure domains in Vercel for preview and production environments |

---

## Level 5 — Integrate with services

Listen to users, extend with automation, AI agents, secure systems, debug production.

| Step | Topic | Description |
|------|-------|-------------|
| 5.1 | User Feedback | Build a feedback system so users can suggest features and report bugs |
| 5.2 | AI Agents | Build a smart assistant that helps users get things done when they ask |
| 5.3 | Mobile Responsive | Test your app across mobile devices and tablets for a great experience |
| 5.4 | Webhook Integration | Connect your app to other services so they automatically stay in sync |
| 5.5 | Webhook Security | Make sure only real requests can trigger your app to prevent hacks |
| 5.6 | Debug Production | Read production logs to quickly find and fix live issues |

---

## Level 6 — Monetize your app

Design pricing, automate billing, gate features, protect payments, share progress.

| Step | Topic | Description |
|------|-------|-------------|
| 6.1 | Product Pricing | Design pricing tiers so your product generates sustainable revenue |
| 6.2 | Payment Provider | Automate billing so subscriptions unlock features instantly |
| 6.3 | Purchase Experience | Design your pricing page and checkout so users upgrade easily |
| 6.4 | Payment Gates | Lock premium features behind plans so only paying customers can access |
| 6.5 | Payment Security | Securely handle payment data so your billing system stays safe |
| 6.6 | Public Changelog | Build a changelog that publicly shows what you shipped to users |

---

## Current state (as of last update)

- **App:** Next.js 16, React 19, server-only Supabase
- **Tables:** `uploads`, `task_suggestions` (Supabase)
- **Schema:** Declarative in `supabase/schemas/`, migrations in `supabase/migrations/`
- **Supabase MCP:** Connected via PAT in Cursor
- **Next:** Wire Document Intake to save/load from Supabase

---

## Related docs

- [feature-planning.md](./feature-planning.md) — Priorities, todos, next feature
- [document-intake-schema.md](./document-intake-schema.md) — Data model
- [supabase-setup.md](./supabase-setup.md) — Project, keys, CLI
- [declarative-schema-workflow.md](./declarative-schema-workflow.md) — Schema changes
- [INTEGRATIONS.md](./INTEGRATIONS.md) — API keys, where used
