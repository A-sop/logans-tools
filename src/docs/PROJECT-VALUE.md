# Project value — average dev equivalent (EUR)

**Benchmark:** The **output an average dev would produce** (work per minute / productivity of an average developer). We value what was built as if an average dev had built it: **value = dev-hours equivalent × hourly rate**.

**Rate — time value for sessions:** **40 EUR/hr** (your hourly rate for valuing session time). For employer-cost benchmarks see `private/cost-estimate-reference.md` (e.g. €52/hr); floor remains 14 EUR/hr if useful.

**Currency:** EUR (Germany / Europe).

**Formula:** Value = dev-hours equivalent × EUR/hour. Savings = same (what you’d have paid a dev to build this).

---

## Total project value (so far)

Rough scope of what’s built (Levels 1–4 done, 5.1 started):

- Next.js 16 app, design system, Tailwind, shadcn/ui
- Supabase (tables, RLS, migrations, server + Clerk client)
- Workspace (assignments, tasks, documents, contacts, timeline, feature voting, “My tasks” RLS demo)
- Clerk auth (sign-in/sign-up, proxy, onboarding, metadata)
- Feedback modal (form, validation, trigger in header)
- Docs, rules, human to-dos, chat primer

**Estimated dev-hours for an average dev to build this from scratch:** ~55–70 hours (single full-stack dev, no AI pair). Benchmark = average dev productivity.

**At €40/hr (your time-value rate):** ~**2,200–2,800 EUR** total project value so far (55–70 h × €40).

**Savings:** Same as total project value — what you’d have paid a dev to build this instead of building it with AI pairing.

Use **40 EUR/hr** for session value; adjust the rate in this doc if you change it.

---

## Project value by typing time (lines of code × junior WPM)

**Idea:** Value the codebase as the time it would take a junior developer to *type* it at average WPM (typing only, no thinking/design).

**Assumptions:**

- **Lines of code (LOC):** `src/` only, .ts / .tsx / .css — **~6,440 lines** (run a line count to refresh).
- **Words:** 1 word = 5 characters; **~45 characters per line** (code average) → words = LOC × 45 ÷ 5.
- **Junior WPM:** **35 WPM** (typical range for junior devs 30–45; 35 is conservative).
- **Rate:** **40 EUR/hr**.

**Formula:**  
Words = LOC × (chars per line) ÷ 5 → Time (hours) = Words ÷ (WPM × 60) → **Value = Time × 40 EUR**.

**This project (current numbers):**

| Step | Value |
|------|--------|
| LOC | ~6,440 |
| Words (6,440 × 45 ÷ 5) | ~57,960 |
| Time (57,960 ÷ (35 × 60)) | ~27.6 hrs |
| **Value at 40 EUR/hr** | **~1,100 EUR** |

Re-run LOC from `src` when the codebase grows; adjust WPM or chars/line if you want a different benchmark.

---

## Going forward — track sessions

Each time you “wrap up” or “done for the day”:

1. Note **session length** (e.g. 2.5 hrs).
2. **Value this session** = hours × 40 EUR (e.g. 2.5 × 40 = 100 EUR).
3. Optionally **append a row** below so you have a running log.

**Value log (optional):**

| Date       | Session hrs | Value (EUR) | Note        |
|------------|-------------|-------------|-------------|
| 2025-02-05 | 2.5         | 100         | Auth, RLS, feedback modal, docs, chat primer |
| 2025-02-08 | 7.85        | 314         | n8n feedback workflow, modal error handling, dev logs, leading-environment rule, docs (~12:30–20:21) |

**Running total (logged sessions):** 10.35 hrs → **414 EUR** at 40 EUR/hr (2025-02-05 + 2025-02-08). Update after each session.
