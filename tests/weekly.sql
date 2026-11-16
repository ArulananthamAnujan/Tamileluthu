-- Transactional tests for weekly homework parts and the presenter. All fixtures are rolled back.
begin;
insert into public.teacher_emails(email) values ('wk-t1@example.invalid');
insert into auth.users(id,email,raw_user_meta_data) values
('e0000000-0000-4000-8000-000000000001','wk-t1@example.invalid','{"role":"teacher","full_name":"T One"}'),
('e0000000-0000-4000-8000-000000000002','wk-s1@example.invalid','{"role":"student","full_name":"Arun"}'),
('e0000000-0000-4000-8000-000000000003','wk-s2@example.invalid','{"role":"student","full_name":"Bavani"}'),
('e0000000-0000-4000-8000-000000000004','wk-s3@example.invalid','{"role":"student","full_name":"Outsider"}'),
('e0000000-0000-4000-8000-000000000005','wk-p1@example.invalid','{"role":"parent","full_name":"P One"}');
update public.profiles set approved = true where not approved;
insert into public.classes(id,name,teacher_id) values('e1000000-0000-4000-8000-00000000000a','Class A','e0000000-0000-4000-8000-000000000001');
insert into public.class_members(class_id,student_id) values
('e1000000-0000-4000-8000-00000000000a','e0000000-0000-4000-8000-000000000002'),
('e1000000-0000-4000-8000-00000000000a','e0000000-0000-4000-8000-000000000003');
insert into public.parent_links(parent_id,student_id) values('e0000000-0000-4000-8000-000000000005','e0000000-0000-4000-8000-000000000002');

set local role authenticated;
select set_config('request.jwt.claim.sub','e0000000-0000-4000-8000-000000000001',true);
do $$ begin
  insert into public.activities(id, class_id, kind, title, copy_work, reading_work, presenter_id, presentation_topic, due_on) values
    ('e2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-00000000000a','homework','Week 5','Copy page 12','Read the story and answer 1-5',
     'e0000000-0000-4000-8000-000000000002','My family','2026-11-22');
  if (select presenter_name from public.activities where id = 'e2000000-0000-4000-8000-000000000001') <> 'Arun' then raise exception 'Presenter name not filled in'; end if;
  begin
    update public.activities set presenter_id = 'e0000000-0000-4000-8000-000000000004' where id = 'e2000000-0000-4000-8000-000000000001';
    raise exception 'Presenter from outside the class accepted';
  exception when check_violation then null; end;
  begin
    update public.activities set presenter_name = 'Someone else' where id = 'e2000000-0000-4000-8000-000000000001';
    raise exception 'Presenter name typed by hand';
  exception when insufficient_privilege then null; end;
end $$;
-- The presenter and their parent are told; the classmate sees the name but gets no presenter notice.
select set_config('request.jwt.claim.sub','e0000000-0000-4000-8000-000000000002',true);
do $$ begin
  if (select count(*) from public.notifications where title like 'Presentation this week: My family%') <> 1 then raise exception 'Presenter was not told'; end if;
  if (select copy_work || reading_work from public.activities) <> 'Copy page 12Read the story and answer 1-5' then raise exception 'Student cannot see the parts'; end if;
end $$;
select set_config('request.jwt.claim.sub','e0000000-0000-4000-8000-000000000005',true);
do $$ begin
  if (select count(*) from public.notifications where title like '%Presentation this week%') <> 1 then raise exception 'Parent was not told'; end if;
end $$;
select set_config('request.jwt.claim.sub','e0000000-0000-4000-8000-000000000003',true);
do $$ begin
  if (select presenter_name from public.activities) <> 'Arun' then raise exception 'Classmate cannot see who presents'; end if;
  if (select count(*) from public.notifications where title like 'Presentation this week%') <> 0 then raise exception 'Classmate got the presenter notice'; end if;
  update public.activities set presenter_id = auth.uid();
  if (select presenter_name from public.activities) <> 'Arun' then raise exception 'Student changed the presenter'; end if;
end $$;
-- Changing the presenter tells the new one; clearing removes the name.
select set_config('request.jwt.claim.sub','e0000000-0000-4000-8000-000000000001',true);
update public.activities set presenter_id = 'e0000000-0000-4000-8000-000000000003' where id = 'e2000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','e0000000-0000-4000-8000-000000000003',true);
do $$ begin
  if (select count(*) from public.notifications where title like 'Presentation this week%') <> 1 then raise exception 'New presenter was not told'; end if;
end $$;
select set_config('request.jwt.claim.sub','e0000000-0000-4000-8000-000000000001',true);
update public.activities set presenter_id = null where id = 'e2000000-0000-4000-8000-000000000001';
do $$ begin
  if (select presenter_name from public.activities where id = 'e2000000-0000-4000-8000-000000000001') is not null then raise exception 'Presenter name left behind'; end if;
end $$;
reset role;
rollback;
