-- Private storage for report PDFs, so they can be shared as a link when a
-- phone's browser refuses to share files directly (common on Samsung).
-- Apply AFTER 20261106000000_essay_marking.sql.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reports', 'reports', false, 15728640, array['application/pdf'])
on conflict (id) do nothing;

-- Each person writes only into their own folder; links are handed out as
-- time-limited signed URLs created by the owner.
create policy reports_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'reports' and (storage.foldername(name))[1] = auth.uid()::text);
create policy reports_select on storage.objects for select to authenticated
  using (bucket_id = 'reports' and (storage.foldername(name))[1] = auth.uid()::text);
create policy reports_delete on storage.objects for delete to authenticated
  using (bucket_id = 'reports' and (storage.foldername(name))[1] = auth.uid()::text);
