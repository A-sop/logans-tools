-- Stage 5: Clerk + Supabase RLS — example table for authenticated user data
-- Requires Clerk as third-party auth provider in Supabase (see auth-flow-prd Stage 5).
-- RLS uses auth.jwt()->>'sub' (Clerk user ID) from the token passed by createSupabaseClientForClerk().

create table if not exists "public"."tasks" (
  "id" serial primary key,
  "name" text not null,
  "user_id" text not null default (auth.jwt()->>'sub'),
  "created_at" timestamptz not null default now()
);

create index if not exists "idx_tasks_user_id" on "public"."tasks" ("user_id");

alter table "public"."tasks" enable row level security;

-- Users can only select their own rows
create policy "User can view their own tasks"
  on "public"."tasks"
  for select
  to authenticated
  using ((select auth.jwt()->>'sub') = (user_id)::text);

-- Users can only insert rows with their own user_id (default handles this)
create policy "Users must insert their own tasks"
  on "public"."tasks"
  as permissive
  for insert
  to authenticated
  with check ((select auth.jwt()->>'sub') = (user_id)::text);
