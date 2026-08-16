-- Document Intake: uploads and task_suggestions tables
-- Generated from supabase/schemas/ (manual migration; db diff requires Docker)
-- https://supabase.com/docs/guides/local-development/declarative-database-schemas

create table "public"."uploads" (
  "id" uuid primary key default gen_random_uuid(),
  "session_id" text not null,
  "filename" text not null,
  "storage_path" text,
  "extracted_text" text,
  "language" text,
  "created_at" timestamptz not null default now()
);

create index "idx_uploads_session_id" on "public"."uploads" ("session_id");

create table "public"."task_suggestions" (
  "id" uuid primary key default gen_random_uuid(),
  "upload_id" uuid not null references "public"."uploads" ("id") on delete cascade,
  "session_id" text not null,
  "title" text not null,
  "due_date" date,
  "note" text,
  "created_at" timestamptz not null default now()
);

create index "idx_task_suggestions_session_id" on "public"."task_suggestions" ("session_id");
create index "idx_task_suggestions_upload_id" on "public"."task_suggestions" ("upload_id");
