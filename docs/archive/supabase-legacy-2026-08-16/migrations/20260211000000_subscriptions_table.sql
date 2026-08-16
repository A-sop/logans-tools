-- Clerk Billing Subscriptions — sync subscription status from Clerk webhooks
-- Created: 2026-02-11
-- Lesson: Payment Implementation Stage 2 — Database Sync

create table if not exists "public"."subscriptions" (
  "id" uuid primary key default gen_random_uuid(),
  "clerk_user_id" text not null,
  "clerk_subscription_id" text not null,
  "plan_key" text not null,
  "status" text not null check ("status" in ('active', 'canceled', 'ended', 'past_due')),
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  -- One subscription per user per plan
  unique ("clerk_user_id", "plan_key")
);

create index if not exists "idx_subscriptions_clerk_user_id" on "public"."subscriptions" ("clerk_user_id");
create index if not exists "idx_subscriptions_status" on "public"."subscriptions" ("status");
create index if not exists "idx_subscriptions_plan_key" on "public"."subscriptions" ("plan_key");

-- Update updated_at on row change
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_subscriptions_updated_at
  before update on "public"."subscriptions"
  for each row
  execute function update_updated_at_column();

alter table "public"."subscriptions" enable row level security;

-- RLS: Server-side only (webhook uses service_role key, bypasses RLS)
-- Future: If we add client-side queries, add policies here
-- For now, webhook writes use service_role key, so RLS is effectively bypassed
