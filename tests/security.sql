-- Transactional integration tests. All fixtures are rolled back.
begin;
insert into public.teacher_emails(email) values('security-teacher@example.invalid');
insert into auth.users(id,email,raw_user_meta_data) values
('11111111-1111-4111-8111-111111111111','security-student@example.invalid','{"role":"student"}'),
('22222222-2222-4222-8222-222222222222','security-other@example.invalid','{"role":"student"}'),
('33333333-3333-4333-8333-333333333333','security-parent@example.invalid','{"role":"parent"}'),
('44444444-4444-4444-8444-444444444444','security-teacher@example.invalid','{"role":"teacher"}');
update public.profiles set approved = true where not approved; -- existing accounts are approved
insert into public.classes(id,name,teacher_id) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Security fixture','44444444-4444-4444-8444-444444444444');
insert into public.class_members(class_id,student_id) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111');
insert into public.parent_links(parent_id,student_id) values('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111');
insert into public.submissions(id,student_id,input_mode,original_text) values
('aaaaaaaa-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','text','தமிழ்'),
('aaaaaaaa-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222','text','தமிழ்');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$ begin
 if (select count(*) from public.submissions)<>1 then raise exception 'Student isolation failed'; end if;
 begin
  insert into public.submissions(student_id,input_mode,photo_paths) values(auth.uid(),'photo',array['22222222-2222-4222-8222-222222222222/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/page-00.jpg']);
  raise exception 'Foreign photo accepted';
 exception when check_violation then null; end;
 begin
  update public.profiles set role='teacher' where id=auth.uid();
  raise exception 'Role escalation allowed';
 exception when insufficient_privilege then null; end;
 begin
  update public.submissions set status='checked' where student_id=auth.uid();
  raise exception 'Student result mutation allowed';
 exception when insufficient_privilege then null; end;
 begin
  perform public.claim_writing_check('aaaaaaaa-1111-4111-8111-111111111111',auth.uid());
  raise exception 'Student work claim allowed';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
do $$ begin
 if (select count(*) from public.submissions)<>1 then raise exception 'Parent isolation failed'; end if;
end $$;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
do $$ begin
 if (select count(*) from public.submissions)<>1 then raise exception 'Teacher isolation failed'; end if;
 perform public.set_teacher_comment('aaaaaaaa-1111-4111-8111-111111111111','Test');
 begin
  perform public.set_teacher_comment('aaaaaaaa-2222-4222-8222-222222222222','Forbidden');
  raise exception 'Other student teacher comment accepted';
 exception when raise_exception then
  if sqlerrm='Other student teacher comment accepted' then raise; end if;
 end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin
  perform public.join_class('ABCDEF'); raise exception 'Anonymous RPC allowed';
 exception when insufficient_privilege then null; end;
 begin
  perform private.is_teacher_email('security-teacher@example.invalid'); raise exception 'Teacher enumeration allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
-- This file tests claiming and limits; the paywall has its own tests (tests/subscriptions.sql).
update public.school_settings set sub_required=false where id=1;
set local role service_role;
do $$ declare r jsonb; begin
 r:=public.claim_writing_check('aaaaaaaa-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');
 if r->>'status'<>'forbidden' then raise exception 'Wrong owner claim accepted'; end if;
 r:=public.claim_writing_check('aaaaaaaa-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111');
 if r->>'status'<>'claimed' then raise exception 'Valid claim failed: %',r; end if;
 r:=public.claim_writing_check('aaaaaaaa-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111');
 if r->>'status'<>'checking' then raise exception 'Duplicate claim accepted'; end if;
 update public.submissions set check_started_at=now()-interval '6 minutes' where id='aaaaaaaa-1111-4111-8111-111111111111';
 r:=public.claim_writing_check('aaaaaaaa-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111');
 if r->>'status'<>'claimed' then raise exception 'Stale recovery failed'; end if;
 update public.submissions set status='checked' where id='aaaaaaaa-1111-4111-8111-111111111111';
 r:=public.claim_writing_check('aaaaaaaa-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111');
 if r->>'status'<>'checked' then raise exception 'Completed work repeated'; end if;
 -- No limits by default: many attempts are still allowed.
 insert into private.check_attempts(student_id,submission_id) select '22222222-2222-4222-8222-222222222222','aaaaaaaa-2222-4222-8222-222222222222' from generate_series(1,50);
 r:=public.claim_writing_check('aaaaaaaa-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222');
 if r->>'status'<>'claimed' then raise exception 'Default should be unlimited: %',r; end if;
 update public.submissions set status='error',check_token=null where id='aaaaaaaa-2222-4222-8222-222222222222';
 delete from private.check_attempts where student_id='22222222-2222-4222-8222-222222222222';
 -- Optional limits set by the admin are enforced.
 update public.school_settings set check_limit_hour=10, check_limit_day=40, check_limit_per_writing=3 where id=1;
 -- Test retry ceiling independently of hourly ceiling.
 insert into private.check_attempts(student_id,submission_id,started_at) select '22222222-2222-4222-8222-222222222222','aaaaaaaa-2222-4222-8222-222222222222',now()-interval '2 days' from generate_series(1,3);
 r:=public.claim_writing_check('aaaaaaaa-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222');
 if r->>'status'<>'limited' then raise exception 'Retry ceiling failed'; end if;
 delete from private.check_attempts where student_id='22222222-2222-4222-8222-222222222222';
 -- Daily limit independent of hourly and submission ceilings.
 insert into private.check_attempts(student_id,submission_id,started_at) select '22222222-2222-4222-8222-222222222222',gen_random_uuid(),now()-interval '2 hours' from generate_series(1,40);
 r:=public.claim_writing_check('aaaaaaaa-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222');
 if r->>'status'<>'limited' then raise exception 'Daily ceiling failed'; end if;
 delete from private.check_attempts where student_id='22222222-2222-4222-8222-222222222222';
 -- Hourly limit independent of submission ceiling.
 insert into private.check_attempts(student_id,submission_id) select '22222222-2222-4222-8222-222222222222',gen_random_uuid() from generate_series(1,10);
 r:=public.claim_writing_check('aaaaaaaa-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222');
 if r->>'status'<>'limited' then raise exception 'Usage limit failed'; end if;
 delete from public.submissions where id='aaaaaaaa-2222-4222-8222-222222222222';
 if (select count(*) from private.check_attempts where student_id='22222222-2222-4222-8222-222222222222')<>10 then raise exception 'Deletion erased usage'; end if;
end $$;
reset role;
rollback;
select 'PASS: isolation, ownership, privileges, claims, retries, limits, retained usage; fixtures rolled back' as result;
