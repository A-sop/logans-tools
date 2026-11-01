# Agent inbox and the watchman (RR-010 step 1)

**Binding on:** every DABOS agent that sends a message to another agent, once logans-tools merges
this and the watchman is live on ln02. **Owner post:** Dept12 Production, Div4.

Logan, 1 Nov 2026 15:18 Berlin: "What about a watchman who makes sure it's absolutely necessary to
wake and if not, adds to the batch. This usage is crazy".

Every message to an agent starts a paid run of that agent. So agents no longer message each other
directly. They leave a row in the Neon table `agent_inbox`, and the **watchman**, a plain script on
ln02 (no AI, no tokens), checks every 5 minutes and decides whether the recipient is woken now or
gets the item in its next batch. The watchman's wake rules are in DABOS #202 (wake rules) and in
code (`src/lib/dabos/watchman.ts`); this page is how to use it.

## How to send

Pick **one** of the two ways. Both give the same row.

### 1. One INSERT through the Neon tool

Project `red-moon-24328019`, branch `br-damp-tree-b1h8mksl` (prod), one statement:

```sql
INSERT INTO agent_inbox (from_agent, to_agent, subject, body, urgency_claim, urgency_reason, deadline_at, blocks, dedupe_key)
VALUES ('div4', 'div5', 'logans-tools #63 ready for Dept13', 'Head <full sha>. Checklist in the PR body.',
        'none', NULL, NULL, NULL, 'div4:lt-pr-63-ready')
ON CONFLICT ON CONSTRAINT agent_inbox_dedupe_content_uq DO NOTHING
RETURNING id;
```

No row back means the same key with the same text is already there (a duplicate; nothing to do).

### 2. The CLI helper

```
npm run --silent dabos:inbox -- send --from div4 --to div5 --subject "logans-tools #63 ready for Dept13" \
  --key div4:lt-pr-63-ready --body "Head <full sha>. Checklist in the PR body."
```

(on ln02 also `scripts/dabos/ln02/dabos-inbox send ...`). Without `DABOS_INBOX_DATABASE_URL` in the
caller's environment it prints the INSERT above, ready for the Neon tool; with it, it inserts. It
refuses rows that look like they hold a secret or an IBAN, and the checks listed below.

## Fields

| Field | Rule |
|---|---|
| `from_agent` | your id: `ldw`, `div1` … `div7` (Dept13/Dept14 send as `div5`), `logan` only for Logan's own words, `watchman` only for the script |
| `to_agent` | one agent id. Never `logan`: Logan's yes/no goes in `approval_queue` (logans-tools #60) |
| `subject` | 1–200 chars. Start an FYI with `FYI`. |
| `body` | up to 8000 chars. The recipient reads it; the watchman never does. |
| `dedupe_key` | 3–200 chars, lowercase, `<from>:<topic>` e.g. `div4:lt-pr-63-ready`. Same key + same text = duplicate, dropped. Same key + **new** text = the newer row **supersedes** the older one if that is still queued. Use a new key for a new topic. |
| `urgency_claim` | `none` (default), `urgent`, `blocking`, `deadline_today` |
| `urgency_reason` | required for any claim. Starts with a reason code, then `:` and free text |
| `deadline_at` | timestamptz, if there is one |
| `blocks` | for `blocking`: who is waiting, e.g. `logan` or `div4` |

## When the watchman wakes the recipient now

Only for one of these. Everything else waits for the batch.

1. **Logan:** `from_agent = 'logan'`, or `from_agent = 'ldw'` with reason code `logan_order` or
   `logan_decision` (LDW relaying Logan's order or decision in his words).
2. **Blocking:** `urgency_claim = 'blocking'`, a reason, and `blocks` naming Logan or a known agent.
3. **Deadline today:** `deadline_at` falls on today's date in Europe/Berlin.
4. **Urgent:** `urgency_claim = 'urgent'` with reason code `prod_down`, `data_loss`, `security`, or
   `deadline_6h` (that one also needs `deadline_at` within the next 6 hours).

A claim that fails its test (no reason, a code not on the list, `blocks` naming nobody known,
`deadline_today` without `deadline_at`) is **downgraded to the batch** and logged.

A wake also brings everything else queued for that agent, so one wake sees everything.

## The batch

Per recipient: at most once every 2 hours, only when something is queued, only between 07:00 and
23:00 Berlin. FYIs go here. Bare acknowledgements and thanks ("received", "noted", "thanks", "on it",
"standing by" ... with a short body) are **suppressed**: kept for the count, never delivered. Don't
send them.

## Receiving (your webhook routine)

Each agent has one Grok Bot routine with a webhook trigger. The watchman POSTs
`{to_agent, batch_id, item_ids, reason}` to it. The routine reads those rows, marks them delivered
and acts. Paste the template in `src/docs/dabos/watchman-routine-prompt.md` into that routine.
Rows POSTed but not marked delivered within 2 hours are sent again with the next wake or batch.

## Never in a subject or body

- Secrets of any kind: API keys, tokens, passwords, connection strings, webhook URLs or keys.
- DVAG client data (names, contract or policy numbers, anything about a client). Client data stays
  on HZR52; refer to it by local file or task id only.
- Whop order data. Agents never query it, so it never appears here.
- Anything else Logan has ruled must stay out of agent messages (refer to it by commit and path).

## Failures

Every watchman failure (a webhook that does not answer 2xx, an agent with no webhook configured, a
metrics write that fails, a crashed tick) is filed as one row per kind per day to `div4`, owner post
**Dept12 Production, Div4**, makes the ln02 unit show failed in the status digest, and stays in
`~/.local/state/dabos-watchman/state.json` until a full, clean, non-dry-run tick.

## Metrics

Once a day the watchman writes `role_runs` (`role_id = 'watchman_daily'`) with the previous Berlin
day's items, wakes, batches, woken and batched items, suppressed, superseded, downgraded and
delivered counts, so the saving can be measured.
