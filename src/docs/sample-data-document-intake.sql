-- Sample data for Document Intake tables
-- Run this in Supabase Dashboard > SQL Editor after migrations are applied
-- https://supabase.com/docs/guides/database/overview#sql-editor

-- Use a placeholder session_id; replace with a real value when testing from your app
insert into public.uploads (session_id, filename, storage_path, extracted_text, language)
values
  ('sample-session-001', 'invoice.pdf', null, 'Sample extracted text from document...', 'en'),
  ('sample-session-001', 'contract.pdf', null, 'Vertragstext...', 'de');

-- Task suggestions for the first upload
insert into public.task_suggestions (upload_id, session_id, title, due_date, note)
select id, session_id, 'Review invoice', '2026-02-15'::date, 'Check line items'
from public.uploads where filename = 'invoice.pdf' limit 1;

insert into public.task_suggestions (upload_id, session_id, title, due_date, note)
select id, session_id, 'Send to accounting', null, 'For approval'
from public.uploads where filename = 'invoice.pdf' limit 1;
