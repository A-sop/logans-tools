-- Document Intake: uploads table
-- Source: src/docs/document-intake-schema.md
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

alter table "public"."uploads" enable row level security;
