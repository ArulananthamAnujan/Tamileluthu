-- Attendance saves exactly the way the app sends them (PostgREST upsert).
begin;
insert into public.teacher_emails(email) values('att-teacher@example.invalid');
insert into auth.users(id,email,raw_user_meta_data) values
('a1111111-1111-4111-8111-111111111111','att-s1@example.invalid','{"role":"student","full_name":"Att S"}'),
('a4444444-4444-4444-8444-444444444444','att-teacher@example.invalid','{"role":"teacher","full_name":"Att T"}');
insert into public.classes(id,name,teacher_id) values('a0aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Att Class','a4444444-4444-4444-8444-444444444444');
insert into public.class_members(class_id,student_id) values('a0aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a1111111-1111-4111-8111-111111111111');
set local role authenticated;
select set_config('request.jwt.claim.sub','a4444444-4444-4444-8444-444444444444',true);
do $$ declare first timestamptz; begin
 -- first tap, then a change of mind on the same day
 insert into public.attendance(class_id,student_id,on_date,status,note,marked_by)
  values('a0aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a1111111-1111-4111-8111-111111111111','2026-11-01','present',null,'a4444444-4444-4444-8444-444444444444')
  on conflict (class_id,student_id,on_date) do update set class_id=excluded.class_id, student_id=excluded.student_id,
   on_date=excluded.on_date, status=excluded.status, note=excluded.note, marked_by=excluded.marked_by;
 select marked_at into first from public.attendance where on_date='2026-11-01';
 insert into public.attendance(class_id,student_id,on_date,status,note,marked_by)
  values('a0aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a1111111-1111-4111-8111-111111111111','2026-11-01','late','bus','a4444444-4444-4444-8444-444444444444')
  on conflict (class_id,student_id,on_date) do update set class_id=excluded.class_id, student_id=excluded.student_id,
   on_date=excluded.on_date, status=excluded.status, note=excluded.note, marked_by=excluded.marked_by;
 if (select status from public.attendance where on_date='2026-11-01')<>'late' then raise exception 'Re-marking did not save'; end if;
 if first is null then raise exception 'marked_at not set'; end if;
 update public.attendance set note='sick' where on_date='2026-11-01';
end $$;
-- the student sees their own record
select set_config('request.jwt.claim.sub','a1111111-1111-4111-8111-111111111111',true);
do $$ begin
 if (select count(*) from public.attendance)<>1 then raise exception 'Student cannot see own attendance'; end if;
 if (select count(*) from public.class_members)<>1 then raise exception 'Student cannot see own class membership'; end if;
 if (select count(*) from public.classes)<>1 then raise exception 'Student cannot see own class'; end if;
 if (select count(*) from public.profiles where id='a4444444-4444-4444-8444-444444444444')<>1 then raise exception 'Student cannot see teacher name'; end if;
end $$;
select 'PASS attendance' as result;
rollback;
