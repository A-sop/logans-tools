-- User Feedback System — feedback table for storing user feedback with AI analysis
-- Created: 2025-02-06
-- Lesson: 5.4 Webhook Integration

create table if not exists "public"."feedback" (
  "id" uuid primary key default gen_random_uuid(),
  "user_id" text,
  "first_name" text not null,
  "last_name" text not null,
  "email" text,
  "message" text not null,
  "browser" text,
  "url" text,
  "sentiment" text check ("sentiment" in ('positive', 'negative', 'neutral')),
  "category" text check ("category" in ('bug', 'feature_request', 'question', 'other')),
  "priority" text check ("priority" in ('low', 'medium', 'high')),
  "summary" text,
  "actionable" boolean,
  "created_at" timestamptz not null default now(),
  "processed_at" timestamptz
);

create index if not exists "idx_feedback_user_id" on "public"."feedback" ("user_id");
create index if not exists "idx_feedback_created_at" on "public"."feedback" ("created_at");
create index if not exists "idx_feedback_sentiment" on "public"."feedback" ("sentiment");
create index if not exists "idx_feedback_category" on "public"."feedback" ("category");
create index if not exists "idx_feedback_priority" on "public"."feedback" ("priority");

alter table "public"."feedback" enable row level security;

-- Users can INSERT their own feedback (user_id matches) OR unauthenticated feedback (user_id IS NULL)
-- Note: For Clerk integration, user_id is a text field containing Clerk user ID
-- RLS policy allows inserts when user_id matches auth.jwt()->>'sub' OR user_id IS NULL
create policy "Users can insert their own feedback"
  on "public"."feedback"
  as permissive
  for insert
  to authenticated
  with check (
    (select auth.jwt()->>'sub') = (user_id)::text
    OR user_id IS NULL
  );

-- Allow unauthenticated inserts (for feedback from signed-out users)
-- This requires allowing anonymous access, which may need to be configured in Supabase
-- For now, we'll allow authenticated users to insert any feedback (including anonymous)
-- Future: Add admin role check for SELECT all feedback
create policy "Allow authenticated inserts"
  on "public"."feedback"
  as permissive
  for insert
  to authenticated
  with check (true);

-- Future: Admins can SELECT all feedback
-- This will require adding admin role metadata check
-- For now, users can only see their own feedback
create policy "Users can view their own feedback"
  on "public"."feedback"
  as permissive
  for select
  to authenticated
  using (
    (select auth.jwt()->>'sub') = (user_id)::text
    OR user_id IS NULL
  );

-- No UPDATE or DELETE permissions — feedback is immutable
-- This ensures data integrity and audit trail
