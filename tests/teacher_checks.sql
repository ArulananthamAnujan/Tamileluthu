-- Teacher's own writing checks. All fixtures are rolled back.
begin;
insert into public.teacher_emails(email) values('tc-teacher@example.invalid'),('tc-teacher2@example.invalid');
insert into auth.users(id,email,raw_user_meta_data) values
('c0000000-0000-4000-8000-000000000001','tc-teacher@example.invalid','{"role":"teacher","full_name":"T"}'),
('c0000000-0000-4000-8000-000000000002','tc-teacher2@example.invalid','{"role":"teacher","full_name":"T2"}'),
('c0000000-0000-4000-8000-000000000003','tc-student@example.invalid','{"role":"student","full_name":"S"}'),
('c0000000-0000-4000-8000-000000000004','tc-other@example.invalid','{"role":"student","full_name":"O"}');
insert into public.classes(id,name,teacher_id) values('c1000000-0000-4000-8000-000000000001','C','c0000000-0000-4000-8000-000000000001');
insert into public.class_members(class_id,student_id) values('c1000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000003');
set local role authenticated;
select set_config('request.jwt.claim.sub','c0000000-0000-4000-8000-000000000001',true);
do $$ begin
  insert into public.submissions(student_id,input_mode,original_text,checked_for) values(auth.uid(),'text','தமிழ்','Walk-in student');
  insert into public.submissions(student_id,input_mode,original_text,checked_for,for_student) values(auth.uid(),'text','தமிழ்','S','c0000000-0000-4000-8000-000000000003');
  begin
    insert into public.submissions(student_id,input_mode,original_text,checked_for,for_student) values(auth.uid(),'text','x','O','c0000000-0000-4000-8000-000000000004');
    raise exception 'Linked a student from another class';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.submissions(student_id,input_mode,original_text,checked_for) values('c0000000-0000-4000-8000-000000000003','text','x','S');
    raise exception 'Teacher created work in a student account';
  exception when insufficient_privilege then null; end;
  if (select count(*) from public.submissions where checked_for is not null)<>2 then raise exception 'Teacher cannot see own checks'; end if;
end $$;
select set_config('request.jwt.claim.sub','c0000000-0000-4000-8000-000000000002',true);
do $$ begin
  if (select count(*) from public.submissions)<>0 then raise exception 'Another teacher sees the checks'; end if;
end $$;
select set_config('request.jwt.claim.sub','c0000000-0000-4000-8000-000000000003',true);
do $$ begin
  if (select count(*) from public.submissions)<>0 then raise exception 'Student sees teacher checks'; end if;
  insert into public.submissions(student_id,input_mode,original_text) values(auth.uid(),'text','தமிழ்');
  begin
    insert into public.submissions(student_id,input_mode,original_text,checked_for,for_student) values(auth.uid(),'text','x','O','c0000000-0000-4000-8000-000000000004');
    raise exception 'Student attached work to another student';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Several checks in a row are allowed (no limits by default).
do $$ declare i int; r jsonb; sid uuid; begin
  for i in 1..12 loop
    insert into public.submissions(id,student_id,input_mode,original_text,checked_for) values(gen_random_uuid(),'c0000000-0000-4000-8000-000000000001','text','x','n') returning id into sid;
    r := private.claim_writing_check(sid,'c0000000-0000-4000-8000-000000000001');
    if r->>'status'<>'claimed' then raise exception 'Parallel check % blocked: %', i, r; end if;
  end loop;
end $$;
select 'PASS: teacher checks private, class-scoped, 12 checks running at once; fixtures rolled back' as result;
rollback;
