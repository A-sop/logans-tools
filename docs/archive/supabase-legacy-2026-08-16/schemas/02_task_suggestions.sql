-- Document Intake: task_suggestions table
-- Depends on: 01_uploads.sql (parent)
-- Source: src/docs/document-intake-schema.md

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

alter table "public"."task_suggestions" enable row level security;
