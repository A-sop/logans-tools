-- Security Advisor: Enable RLS on uploads and task_suggestions
-- Fixes: rls_disabled_in_public, sensitive_columns_exposed
-- https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public

alter table "public"."uploads" enable row level security;
alter table "public"."task_suggestions" enable row level security;

-- No permissive policies for anon/authenticated = no access via publishable key.
-- service_role bypasses RLS, so server-side (Server Actions) keeps full access.
