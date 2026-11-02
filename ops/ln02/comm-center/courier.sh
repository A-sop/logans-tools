#!/usr/bin/env bash
# Comm-center courier: OUT → IN (or file / Dept2 exception). Idempotent; one transaction; no bodies in logs.
# Usage: courier.sh [--post Div4]   (default: all posts due for courier this minute)
# Note: --post selects which wake slots are considered by the runner; this SQL still routes
# every eligible OUT row in one transaction (global courier pass).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "$ROOT/lib.sh"

CC_ENV_FILE="${CC_ENV_FILE:-$HOME/.config/dabos/comm-center.env}"
CC_STATE_DIR="${CC_STATE_DIR:-$HOME/.local/state/dabos/comm-center}"
CC_LOG_FILE="${CC_LOG_FILE:-$CC_STATE_DIR/comm-center.jsonl}"
CC_CSV_FILE="${CC_CSV_FILE:-$CC_STATE_DIR/counts.csv}"
CC_COURIER_MODE=1
export CC_COURIER_MODE

cc_load_env "$CC_ENV_FILE"
# Also load clocks from example defaults if COMM_CLOCK_* unset — clocks.env next to this script
if [ -f "$ROOT/clocks.env" ]; then
  cc_load_env "$ROOT/clocks.env"
elif [ -f "$ROOT/clocks.env.example" ] && ! env | grep -q '^COMM_CLOCK_'; then
  cc_load_env "$ROOT/clocks.env.example"
fi

DB_URL="${COMM_CENTER_DATABASE_URL:-${WAKE_DATABASE_URL:-${DATABASE_URL:-}}}"
if [ -z "$DB_URL" ]; then
  echo "courier: COMM_CENTER_DATABASE_URL (or WAKE_DATABASE_URL) required" >&2
  exit 1
fi

ONLY_POST=""
for a in "$@"; do
  case "$a" in
    --post) shift; ONLY_POST="${1:-}"; shift || true ;;
  esac
done

POSTS=(Div1 Div2 Div3 Div4 Div5 Div6 Div7 LDW)
if [ -n "$ONLY_POST" ]; then
  POSTS=("$ONLY_POST")
fi

# SQL: move OUT with ingest_meta.to → addressee IN; no to → filed_at; bad to → Dept2 IN.
# Routing stamps routed_at/routed_from and clears `to` so hat-receipt OUT cannot loop.
# Excludes filed_at / done / cancelled. Never leaves a self-route `to`.
# Then P2: mark pending.cleared when blocker is out/done/cancelled.
# Then P4 stalls into Dept2 IN (idempotent dept2-stall:<id>:<date>).
# P5: last_checked on all pending for touched posts.
COURIER_SQL="$(cat <<'SQL'
BEGIN;

-- 1) File handled OUT with no 'to'
UPDATE tasks
   SET ingest_meta = coalesce(ingest_meta, '{}'::jsonb)
         || jsonb_build_object('filed_at', to_jsonb(NOW())),
       updated_at = NOW()
 WHERE basket = 'out'
   AND (ingest_meta ? 'filed_at') IS NOT TRUE
   AND status NOT IN ('done', 'cancelled')
   AND (ingest_meta->>'to' IS NULL OR btrim(ingest_meta->>'to') = '');

-- 1b) File done/cancelled OUT (never re-deliver)
UPDATE tasks
   SET ingest_meta = coalesce(ingest_meta, '{}'::jsonb)
         || jsonb_build_object('filed_at', to_jsonb(NOW())),
       updated_at = NOW()
 WHERE basket = 'out'
   AND (ingest_meta ? 'filed_at') IS NOT TRUE
   AND status IN ('done', 'cancelled');

-- 2) Misrouted / unknown 'to' → Dept2 IN (Div1 / Dept2); clear to so it cannot loop
UPDATE tasks
   SET basket = 'in',
       division_id = 'Div1',
       department_id = 'Dept2',
       assigned_agent = NULL,
       ingest_meta = (coalesce(ingest_meta, '{}'::jsonb)
         || jsonb_build_object(
              'misrouted_at', to_jsonb(NOW()),
              'misrouted_from_to', ingest_meta->>'to',
              'routed_at', to_jsonb(NOW()),
              'routed_from', ingest_meta->>'to'
            )) - 'to',
       updated_at = NOW()
 WHERE basket = 'out'
   AND (ingest_meta ? 'filed_at') IS NOT TRUE
   AND status NOT IN ('done', 'cancelled')
   AND ingest_meta->>'to' IS NOT NULL
   AND btrim(ingest_meta->>'to') <> ''
   AND upper(btrim(ingest_meta->>'to')) NOT IN (
     'DIV1','DIV2','DIV3','DIV4','DIV5','DIV6','DIV7','LDW',
     'DEPT1','DEPT2','DEPT3','DEPT4','DEPT5','DEPT6','DEPT7','DEPT8','DEPT9',
     'DEPT10','DEPT11','DEPT12','DEPT13','DEPT14','DEPT15','DEPT16','DEPT17',
     'DEPT18','DEPT19','DEPT20','DEPT21'
   );

-- 2b) Self-route (to resolves to current holder) → file; never bounce forever
UPDATE tasks t
   SET ingest_meta = (coalesce(t.ingest_meta, '{}'::jsonb)
         || jsonb_build_object(
              'filed_at', to_jsonb(NOW()),
              'self_route_from', t.ingest_meta->>'to'
            )) - 'to',
       updated_at = NOW()
 WHERE t.basket = 'out'
   AND (t.ingest_meta ? 'filed_at') IS NOT TRUE
   AND t.status NOT IN ('done', 'cancelled')
   AND t.ingest_meta->>'to' IS NOT NULL
   AND btrim(t.ingest_meta->>'to') <> ''
   AND upper(btrim(t.ingest_meta->>'to')) IN (
     'DIV1','DIV2','DIV3','DIV4','DIV5','DIV6','DIV7','LDW',
     'DEPT1','DEPT2','DEPT3','DEPT4','DEPT5','DEPT6','DEPT7','DEPT8','DEPT9',
     'DEPT10','DEPT11','DEPT12','DEPT13','DEPT14','DEPT15','DEPT16','DEPT17',
     'DEPT18','DEPT19','DEPT20','DEPT21'
   )
   AND (
     (
       upper(btrim(t.ingest_meta->>'to')) LIKE 'DIV%'
       AND ('Div' || right(upper(btrim(t.ingest_meta->>'to')), 1))
           = coalesce(t.assigned_agent, t.division_id)
     )
     OR (
       upper(btrim(t.ingest_meta->>'to')) = 'LDW'
       AND upper(coalesce(t.assigned_agent, '')) = 'LDW'
     )
     OR (
       upper(btrim(t.ingest_meta->>'to')) LIKE 'DEPT%'
       AND t.department_id = ('Dept' || (substring(upper(btrim(t.ingest_meta->>'to')) from 5)::int)::text)
       AND t.division_id = (
         'Div' || ((ceil(substring(upper(btrim(t.ingest_meta->>'to')) from 5)::numeric / 3))::int)::text
       )
       AND (t.assigned_agent IS NULL OR t.assigned_agent NOT IN (
         'LDW','ldw','Ldw','Div1','Div2','Div3','Div4','Div5','Div6','Div7'
       ))
     )
   );

-- 3) Route OUT → IN for Div/Dept/LDW posts; stamp routed_*; clear `to`
UPDATE tasks t
   SET basket = 'in',
       division_id = CASE
         WHEN upper(btrim(t.ingest_meta->>'to')) LIKE 'DIV%' THEN
           'Div' || right(upper(btrim(t.ingest_meta->>'to')), 1)
         WHEN upper(btrim(t.ingest_meta->>'to')) = 'LDW' THEN t.division_id
         WHEN upper(btrim(t.ingest_meta->>'to')) LIKE 'DEPT%' THEN
           'Div' || ((ceil(substring(upper(btrim(t.ingest_meta->>'to')) from 5)::numeric / 3))::int)::text
         ELSE t.division_id
       END,
       department_id = CASE
         WHEN upper(btrim(t.ingest_meta->>'to')) LIKE 'DEPT%' THEN
           'Dept' || (substring(upper(btrim(t.ingest_meta->>'to')) from 5)::int)::text
         ELSE t.department_id
       END,
       assigned_agent = CASE
         WHEN upper(btrim(t.ingest_meta->>'to')) = 'LDW' THEN 'LDW'
         WHEN upper(btrim(t.ingest_meta->>'to')) LIKE 'DIV%' THEN
           'Div' || right(upper(btrim(t.ingest_meta->>'to')), 1)
         ELSE t.assigned_agent
       END,
       ingest_meta = (coalesce(t.ingest_meta, '{}'::jsonb)
         || jsonb_build_object(
              'routed_at', to_jsonb(NOW()),
              'routed_from', t.ingest_meta->>'to'
            )) - 'to',
       updated_at = NOW()
 WHERE t.basket = 'out'
   AND (t.ingest_meta ? 'filed_at') IS NOT TRUE
   AND t.status NOT IN ('done', 'cancelled')
   AND t.ingest_meta->>'to' IS NOT NULL
   AND btrim(t.ingest_meta->>'to') <> ''
   AND upper(btrim(t.ingest_meta->>'to')) IN (
     'DIV1','DIV2','DIV3','DIV4','DIV5','DIV6','DIV7','LDW',
     'DEPT1','DEPT2','DEPT3','DEPT4','DEPT5','DEPT6','DEPT7','DEPT8','DEPT9',
     'DEPT10','DEPT11','DEPT12','DEPT13','DEPT14','DEPT15','DEPT16','DEPT17',
     'DEPT18','DEPT19','DEPT20','DEPT21'
   )
   AND NOT (
     (
       upper(btrim(t.ingest_meta->>'to')) LIKE 'DIV%'
       AND ('Div' || right(upper(btrim(t.ingest_meta->>'to')), 1))
           = coalesce(t.assigned_agent, t.division_id)
     )
     OR (
       upper(btrim(t.ingest_meta->>'to')) = 'LDW'
       AND upper(coalesce(t.assigned_agent, '')) = 'LDW'
     )
     OR (
       upper(btrim(t.ingest_meta->>'to')) LIKE 'DEPT%'
       AND t.department_id = ('Dept' || (substring(upper(btrim(t.ingest_meta->>'to')) from 5)::int)::text)
       AND t.division_id = (
         'Div' || ((ceil(substring(upper(btrim(t.ingest_meta->>'to')) from 5)::numeric / 3))::int)::text
       )
       AND (t.assigned_agent IS NULL OR t.assigned_agent NOT IN (
         'LDW','ldw','Ldw','Div1','Div2','Div3','Div4','Div5','Div6','Div7'
       ))
     )
   );

-- 4) P2: clear pending when blocker task is out / done / cancelled
UPDATE tasks p
   SET ingest_meta = jsonb_set(
         coalesce(p.ingest_meta, '{}'::jsonb),
         '{pending,cleared}',
         'true'::jsonb,
         true
       ),
       updated_at = NOW()
 WHERE p.basket = 'pending'
   AND coalesce((p.ingest_meta->'pending'->>'cleared')::boolean, false) IS NOT TRUE
   AND (p.ingest_meta->'pending'->'waiting_on'->>'task_id') IS NOT NULL
   AND EXISTS (
     SELECT 1 FROM tasks b
      WHERE b.id::text = p.ingest_meta->'pending'->'waiting_on'->>'task_id'
        AND (b.basket = 'out' OR b.status IN ('done', 'cancelled'))
   );

-- 5) P5: last_checked on every pending row
UPDATE tasks
   SET ingest_meta = jsonb_set(
         coalesce(ingest_meta, '{}'::jsonb),
         '{pending,last_checked}',
         to_jsonb(NOW()),
         true
       ),
       updated_at = NOW()
 WHERE basket = 'pending';

-- 6) P4 stalls → Dept2 IN (one per task per Berlin day via ingest idempotent index)
WITH berlin_day AS (
  SELECT to_char(NOW() AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD') AS d
),
stalls AS (
  SELECT t.id,
         t.title,
         CASE
           WHEN t.basket = 'pending'
            AND (t.ingest_meta->'pending'->>'since') IS NOT NULL
            AND (t.ingest_meta->'pending'->>'since')::timestamptz < NOW() - interval '7 days'
             THEN 'pending_gt_7d'
           WHEN t.basket = 'pending'
            AND (t.ingest_meta->'pending'->>'clear_by') IS NOT NULL
            AND (t.ingest_meta->'pending'->>'clear_by')::timestamptz < NOW() - interval '24 hours'
             THEN 'clear_by_gt_24h'
           WHEN t.basket = 'pending'
            AND (t.ingest_meta->'pending'->'waiting_on'->>'task_id') IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM tasks b
               WHERE b.id::text = t.ingest_meta->'pending'->'waiting_on'->>'task_id'
                 AND b.basket = 'pending'
                 AND (b.ingest_meta->'pending'->>'since') IS NOT NULL
                 AND (b.ingest_meta->'pending'->>'since')::timestamptz < NOW() - interval '72 hours'
            )
             THEN 'blocker_pending_gt_72h'
           WHEN t.basket = 'pending'
            AND (t.ingest_meta->'pending'->'waiting_on'->>'task_id') IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM tasks b
               WHERE b.id::text = t.ingest_meta->'pending'->'waiting_on'->>'task_id'
                 AND b.basket = 'in'
                 AND b.created_at < NOW() - interval '24 hours'
            )
             THEN 'blocker_in_gt_24h'
           ELSE NULL
         END AS rule
    FROM tasks t
)
INSERT INTO tasks (
  workspace_id, division_id, department_id, title, description,
  type, status, priority, basket, ingest_source, ingest_external_id, ingest_meta
)
SELECT
  'comm-center',
  'Div1',
  'Dept2',
  'Stall: ' || left(s.title, 120),
  'Dept2 stall of ' || s.id::text || ' rule ' || s.rule,
  'agent',
  'todo',
  2,
  'in',
  'dept2-stall',
  s.id::text || ':' || (SELECT d FROM berlin_day),
  jsonb_build_object('stall_of', s.id::text, 'rule', s.rule, 'from', 'comm-center-courier')
FROM stalls s
WHERE s.rule IS NOT NULL
ON CONFLICT DO NOTHING;

COMMIT;
SQL
)"

mkdir -p "$CC_STATE_DIR"
POST=courier
export POST

if [ "${CC_DRY_RUN:-0}" = "1" ]; then
  cc_log_json event=courier-dry-run decision=skip
  exit 0
fi

if ! command -v psql >/dev/null; then
  cc_log_json event=courier-missing-psql decision=error
  exit 1
fi

set +e
cc_psql -1 -c "$COURIER_SQL" >/dev/null
RC=$?
set -e

if [ "$RC" -ne 0 ]; then
  cc_log_json event=courier-failed decision=error
  exit 1
fi

cc_log_json event=courier-ok decision=skip
exit 0
