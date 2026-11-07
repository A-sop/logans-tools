# Founder approval queue (`approval_queue`) — Logan's yes/no (RR-010 step 2)

**Canonical name:** Founder approval queue. **Not** “A5 decision table” (retired — A5 is the human-only send/pay/sign *rule*, not this board).  
DABOS pointer: `C:\Dev\DABOS\docs\reference\dept02-coordination\founder-approval-queue.md`.

Logan, Sun 1 Nov 2026, 14:54 Berlin (relayed by LDW Communicator): "Build the wake rules, the
approval queue and one status digest on ln02? Yes to steps 1–3".

Every item that needs Logan's yes is **one row** in Neon `approval_queue`. The agent that will do
the work reads the decided row itself. Nobody relays the decision to every interested division.

## What goes in

| decision | when | dedupe_key |
|---|---|---|
| `merge` | a PR with a Dept13 PASS at its head sha needs Logan's merge yes | `merge:<owner>/<repo>#<pr>@<head sha, 12 chars>` |
| `prod_apply` | a dated SQL file needs applying to Neon prod | `prod_apply:<owner>/<repo>#<pr>@<head sha, 12 chars>` |
| `machine_change` | a lasting change on ln02, HZR52 or another machine | `machine_change:<host>:<slug>` |
| `secret_placement` | Logan has to place a secret himself (names only, never values) | `secret_placement:<host>:<slug>` |
| `policy` | a new rule or ruling that needs Logan | `policy:<slug>` |
| `other` | anything else that needs Logan's yes | `other:<slug>` |

A merge and its prod apply can share one row when Logan decides them together; use `prod_apply`
and say so in the title.

## Columns

- `kind`: always `'other'` for these rows (the Tier0 kinds predate this standard); the decision
  type lives in `payload.decision`.
- `title`: one line Logan can answer with yes or no, for example
  `Merge logans-tools #61 and apply its SQL on prod?`
- `body`: at most a few lines: what changes, the risk, the undo.
- `payload`: `decision`, `repo`, `pr`, `head_sha` (full), `dept13_verdict` (exactly `PASS @<full 40-hex head sha>`;
  Dept13 verdicts are PASS or FAIL only),
  `apply_method` (for SQL), `host` (for machine changes), `order_ref` (e.g. `RR-010`), and, once
  decided, `logan_words` and `logan_at` (Berlin time) when the decision came through LDW
  Communicator.
- `requested_by`: the filing post, e.g. `Div4`. `division_id` / `department_id`: the doing post.
- `dedupe_key`: from the table above (built by `decisionKey()` in
  `src/lib/dabos/approval-queue-standard.ts`). Filing twice is a no-op.

Never put DVAG client data, prospect names, account ids or secret values in any column. Refer to
sensitive values by commit and path only.

## Filing (the doing agent)

```sql
INSERT INTO approval_queue (kind, title, body, payload, requested_by, division_id, department_id, dedupe_key)
VALUES ('other', $1, $2, $3::jsonb, 'Div4', 'Div4', 'Dept11', $4)
ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
```

File only after the Dept13 PASS at the same head sha. Then send nothing else: LDW Communicator
and the status digest read pending rows.

## Deciding (Logan, or LDW Communicator relaying Logan verbatim)

- Logan decides on the Tier0 board, `/approve <id>` or the Tier0 API: `decided_by` = `founder`.
- LDW Communicator, relaying Logan's exact words for that specific item (LDW Communicator
  authority rule): set `status`, `decided_by = 'Logan via LDW Communicator'`, `decided_at = now()`,
  and add `logan_words` and `logan_at` to `payload`, only `WHERE id = $1 AND status = 'pending'`.
- No other agent decides a row. Sending, paying and signing stay with Logan in person; a row
  never stands in for that.

## Acting (the doing agent)

Act only when the row is `approved` **and** `payload.head_sha` and the PR's current head sha are
both present, both the full 40-hex sha, and equal (`decisionState()` returns `act` only then; a
missing, short or long sha on either side is `stale_sha`). If
anything was pushed after the decision, set the row to `expired` (it needs a new Dept13 PASS and
a new row). After acting, write the receipt (merge sha, apply method, digest) on the PR, not in
a message. A `rejected` row closes the item.

## Reading

```sql
SELECT id, title, payload->>'decision' AS decision, requested_by, created_at
FROM approval_queue WHERE status = 'pending' ORDER BY created_at;
```
