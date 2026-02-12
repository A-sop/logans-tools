-- Workspace documents: user-scoped file list for data isolation testing (4.5) and general use.
-- Requires Clerk JWT (auth.jwt()->>'sub'). Create bucket "workspace-documents" in Supabase Dashboard → Storage if using file upload.

create table if not exists "public"."workspace_documents" (
  "id" uuid primary key default gen_random_uuid(),
  "user_id" text not null default (auth.jwt()->>'sub'),
  "filename" text not null,
  "storage_path" text,
  "file_size" integer,
  "content_type" text,
  "created_at" timestamptz not null default now()
);

create index if not exists "idx_workspace_documents_user_id" on "public"."workspace_documents" ("user_id");

alter table "public"."workspace_documents" enable row level security;

create policy "User can view own workspace documents"
  on "public"."workspace_documents"
  for select
  to authenticated
  using ((select auth.jwt()->>'sub') = user_id);

create policy "User can insert own workspace documents"
  on "public"."workspace_documents"
  for insert
  to authenticated
  with check ((select auth.jwt()->>'sub') = user_id);
