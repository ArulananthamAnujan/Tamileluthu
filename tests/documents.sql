-- Transactional tests for shared documents. Run after all migrations. All fixtures are rolled back.
begin;
insert into public.teacher_emails(email, is_admin) values
  ('dc-admin@example.invalid', true), ('dc-t1@example.invalid', false), ('dc-t2@example.invalid', false);
insert into auth.users(id,email,raw_user_meta_data) values
('d0000000-0000-4000-8000-000000000001','dc-admin@example.invalid','{"role":"teacher","full_name":"Admin"}'),
('d0000000-0000-4000-8000-000000000002','dc-t1@example.invalid','{"role":"teacher","full_name":"T One"}'),
('d0000000-0000-4000-8000-000000000003','dc-t2@example.invalid','{"role":"teacher","full_name":"T Two"}'),
('d0000000-0000-4000-8000-000000000004','dc-s1@example.invalid','{"role":"student","full_name":"S One"}'),
('d0000000-0000-4000-8000-000000000005','dc-s2@example.invalid','{"role":"student","full_name":"S Two"}'),
('d0000000-0000-4000-8000-000000000006','dc-p1@example.invalid','{"role":"parent","full_name":"P One"}');
update public.profiles set approved = true where not approved;
insert into public.classes(id,name,teacher_id) values
('d1000000-0000-4000-8000-00000000000a','Batch A','d0000000-0000-4000-8000-000000000002'),
('d1000000-0000-4000-8000-00000000000b','Batch B','d0000000-0000-4000-8000-000000000002'),
('d1000000-0000-4000-8000-00000000000c','Batch C','d0000000-0000-4000-8000-000000000003');
insert into public.class_members(class_id,student_id) values
('d1000000-0000-4000-8000-00000000000a','d0000000-0000-4000-8000-000000000004'),
('d1000000-0000-4000-8000-00000000000b','d0000000-0000-4000-8000-000000000005');
insert into public.parent_links(parent_id,student_id) values('d0000000-0000-4000-8000-000000000006','d0000000-0000-4000-8000-000000000004');

set local role authenticated;
-- Teacher 1 uploads a document and shares it with batch A only.
select set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-000000000002',true);
do $$ begin
  insert into storage.objects(bucket_id, name) values('documents', 'd0000000-0000-4000-8000-000000000002/d2000000-0000-4000-8000-000000000001.pdf');
  insert into public.documents(id, title, file_path, file_name, size) values('d3000000-0000-4000-8000-000000000001', 'Workbook',
    'd0000000-0000-4000-8000-000000000002/d2000000-0000-4000-8000-000000000001.pdf', 'Workbook.pdf', 1000);
  begin
    insert into public.documents(title, file_path, file_name) values('Other folder', 'd0000000-0000-4000-8000-000000000003/d2000000-0000-4000-8000-000000000002.pdf', 'x.pdf');
    raise exception 'Document in another teacher''s folder accepted';
  exception when check_violation then null; end;
  begin
    insert into storage.objects(bucket_id, name) values('documents', 'd0000000-0000-4000-8000-000000000003/d2000000-0000-4000-8000-000000000002.pdf');
    raise exception 'Uploaded into another teacher''s folder';
  exception when insufficient_privilege then null; end;
  insert into public.document_classes(document_id, class_id) values('d3000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-00000000000a');
  begin
    insert into public.document_classes(document_id, class_id) values('d3000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-00000000000c');
    raise exception 'Shared with another teacher''s class';
  exception when insufficient_privilege then null; end;
end $$;
-- Batch A student and parent can see and open it; they are told about it.
select set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-000000000004',true);
do $$ begin
  if (select count(*) from public.documents) <> 1 or (select count(*) from storage.objects where bucket_id = 'documents') <> 1 then
    raise exception 'Student cannot see the shared document'; end if;
  if (select count(*) from public.notifications where link = '#/documents') <> 1 then raise exception 'Student was not told'; end if;
  begin
    insert into public.documents(title, file_path, file_name) values('Mine', 'd0000000-0000-4000-8000-000000000004/d2000000-0000-4000-8000-000000000009.pdf', 'm.pdf');
    raise exception 'Student added a document';
  exception when insufficient_privilege then null; end;
  delete from public.documents; delete from public.document_classes;
  if (select count(*) from public.documents) <> 1 or (select count(*) from public.document_classes) <> 1 then raise exception 'Student removed a document'; end if;
end $$;
select set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-000000000006',true);
do $$ begin
  if (select count(*) from public.documents) <> 1 or (select count(*) from storage.objects where bucket_id = 'documents') <> 1 then
    raise exception 'Parent cannot see the shared document'; end if;
end $$;
-- Batch B and the other teacher cannot, until it is shared with batch B too.
select set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-000000000005',true);
do $$ begin
  if (select count(*) from public.documents) <> 0 or (select count(*) from storage.objects where bucket_id = 'documents') <> 0 then
    raise exception 'Another batch sees the document'; end if;
end $$;
select set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-000000000003',true);
do $$ begin
  if (select count(*) from public.documents) <> 0 then raise exception 'Another teacher sees the document'; end if;
  begin
    insert into public.document_classes(document_id, class_id) values('d3000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-00000000000c');
    raise exception 'Teacher shared someone else''s document';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-000000000002',true);
insert into public.document_classes(document_id, class_id) values('d3000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-00000000000b');
select set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-000000000005',true);
do $$ begin
  if (select count(*) from public.documents) <> 1 or (select count(*) from storage.objects where bucket_id = 'documents') <> 1 then
    raise exception 'Batch B cannot see the document after sharing'; end if;
end $$;
-- Taking it back from batch A hides it there again.
select set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-000000000002',true);
delete from public.document_classes where class_id = 'd1000000-0000-4000-8000-00000000000a';
select set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-000000000004',true);
do $$ begin
  if (select count(*) from public.documents) <> 0 or (select count(*) from storage.objects where bucket_id = 'documents') <> 0 then
    raise exception 'Document still visible after it was taken back'; end if;
end $$;
-- An admin can share their own document with any class in the school.
select set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-000000000001',true);
do $$ begin
  insert into public.documents(id, title, file_path, file_name) values('d3000000-0000-4000-8000-000000000002', 'School notice',
    'd0000000-0000-4000-8000-000000000001/d2000000-0000-4000-8000-000000000003.pdf', 'Notice.pdf');
  insert into public.document_classes(document_id, class_id) values
    ('d3000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-00000000000a'),
    ('d3000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-00000000000c');
end $$;
select set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-000000000004',true);
do $$ begin if (select title from public.documents) <> 'School notice' then raise exception 'Admin document not visible to the class'; end if; end $$;
reset role;
rollback;
