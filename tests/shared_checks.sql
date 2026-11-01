-- A teacher's check for a student is visible to that student and their
-- parents (with photos), not to other students or parents; they are notified.
begin;
insert into public.teacher_emails(email) values('sc-t@example.invalid');
insert into auth.users(id,email,raw_user_meta_data) values
('5c000000-0000-4000-8000-000000000001','sc-t@example.invalid','{"role":"teacher","full_name":"SC Teacher"}'),
('5c000000-0000-4000-8000-000000000002','sc-s1@example.invalid','{"role":"student","full_name":"SC Kid"}'),
('5c000000-0000-4000-8000-000000000003','sc-s2@example.invalid','{"role":"student","full_name":"SC Other"}'),
('5c000000-0000-4000-8000-000000000004','sc-p1@example.invalid','{"role":"parent","full_name":"SC Parent"}'),
('5c000000-0000-4000-8000-000000000005','sc-p2@example.invalid','{"role":"parent","full_name":"SC Other Parent"}');
insert into public.classes(id,name,teacher_id) values('5c0aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','SC','5c000000-0000-4000-8000-000000000001');
insert into public.class_members(class_id,student_id) values
('5c0aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','5c000000-0000-4000-8000-000000000002'),
('5c0aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','5c000000-0000-4000-8000-000000000003');
insert into public.parent_links(parent_id,student_id) values
('5c000000-0000-4000-8000-000000000004','5c000000-0000-4000-8000-000000000002'),
('5c000000-0000-4000-8000-000000000005','5c000000-0000-4000-8000-000000000003');
insert into public.submissions(id,student_id,input_mode,original_text,photo_paths,checked_for,for_student) values
('5c0bbbbb-0000-4000-8000-000000000001','5c000000-0000-4000-8000-000000000001','photo','x',
 array['5c000000-0000-4000-8000-000000000001/5c0bbbbb-0000-4000-8000-000000000001/page-01.jpg'],'SC Kid','5c000000-0000-4000-8000-000000000002');
insert into storage.objects(bucket_id,name) values('writing','5c000000-0000-4000-8000-000000000001/5c0bbbbb-0000-4000-8000-000000000001/page-01.jpg');
update public.submissions set status='checked' where id='5c0bbbbb-0000-4000-8000-000000000001';
do $$ begin
 if (select count(*) from public.notifications where title like '%Writing feedback ready%'
     and user_id in ('5c000000-0000-4000-8000-000000000002','5c000000-0000-4000-8000-000000000004'))<>2 then
  raise exception 'Student and parent not notified'; end if;
end $$;
set local role authenticated;
do $$ declare who uuid; ok int; begin
 foreach who in array array['5c000000-0000-4000-8000-000000000002','5c000000-0000-4000-8000-000000000004']::uuid[] loop
  perform set_config('request.jwt.claim.sub',who::text,true);
  if (select count(*) from public.submissions where id='5c0bbbbb-0000-4000-8000-000000000001')<>1 then raise exception 'Cannot see check: %', who; end if;
  if (select count(*) from storage.objects where bucket_id='writing')<>1 then raise exception 'Cannot see photo: %', who; end if;
 end loop;
 foreach who in array array['5c000000-0000-4000-8000-000000000003','5c000000-0000-4000-8000-000000000005']::uuid[] loop
  perform set_config('request.jwt.claim.sub',who::text,true);
  if (select count(*) from public.submissions where id='5c0bbbbb-0000-4000-8000-000000000001')<>0 then raise exception 'Other family sees check: %', who; end if;
  if (select count(*) from storage.objects where bucket_id='writing')<>0 then raise exception 'Other family sees photo: %', who; end if;
 end loop;
 -- the student still cannot change or delete the teacher's check
 perform set_config('request.jwt.claim.sub','5c000000-0000-4000-8000-000000000002',true);
 delete from public.submissions where id='5c0bbbbb-0000-4000-8000-000000000001';
 get diagnostics ok = row_count;
 if ok<>0 then raise exception 'Student deleted teacher check'; end if;
end $$;
select 'PASS shared teacher checks' as result;
rollback;
