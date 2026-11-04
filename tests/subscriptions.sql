-- Paid monthly access to the writing checker. All fixtures are rolled back.
begin;
insert into public.teacher_emails(email,is_admin) values('sub-admin@example.invalid',true),('sub-teacher@example.invalid',false);
insert into auth.users(id,email,raw_user_meta_data) values
('d0000000-0000-4000-8000-000000000001','sub-admin@example.invalid','{"role":"teacher","full_name":"Admin"}'),
('d0000000-0000-4000-8000-000000000002','sub-teacher@example.invalid','{"role":"teacher","full_name":"T"}'),
('d0000000-0000-4000-8000-000000000003','sub-s1@example.invalid','{"role":"student","full_name":"Paid"}'),
('d0000000-0000-4000-8000-000000000004','sub-s2@example.invalid','{"role":"student","full_name":"Unpaid"}'),
('d0000000-0000-4000-8000-000000000005','sub-p@example.invalid','{"role":"parent","full_name":"P"}');
update public.profiles set approved = true where not approved; -- existing accounts are approved
insert into public.parent_links(parent_id,student_id) values('d0000000-0000-4000-8000-000000000005','d0000000-0000-4000-8000-000000000004');
update public.school_settings set sub_required=true, sub_trial_checks=2, sub_checks_per_month=3 where id=1;

-- helper: a new piece of writing for a person
create temp table ids(n int, id uuid);
insert into ids select g, gen_random_uuid() from generate_series(1,12) g;
insert into public.submissions(id,student_id,input_mode,original_text)
select id, case when n<=5 then 'd0000000-0000-4000-8000-000000000004'::uuid when n<=10 then 'd0000000-0000-4000-8000-000000000003'::uuid else 'd0000000-0000-4000-8000-000000000002'::uuid end,'text','x' from ids;
update public.submissions set checked_for='x' where student_id='d0000000-0000-4000-8000-000000000002';

do $$ declare r jsonb; i int; sid uuid; begin
  -- Unpaid student: 2 free trial checks, then payment required.
  for i in 1..2 loop
    select id into sid from ids where n=i;
    r := private.claim_writing_check(sid,'d0000000-0000-4000-8000-000000000004');
    if r->>'status'<>'claimed' then raise exception 'Trial check % refused: %', i, r; end if;
  end loop;
  select id into sid from ids where n=3;
  r := private.claim_writing_check(sid,'d0000000-0000-4000-8000-000000000004');
  if r->>'status'<>'payment_required' then raise exception 'Paywall missing: %', r; end if;

  -- Paid student: 3 checks this month, then quota.
  insert into public.subscriptions(student_id,status,current_period_start,current_period_end)
  values('d0000000-0000-4000-8000-000000000003','active',now()-interval '1 day',now()+interval '29 days');
  for i in 6..8 loop
    select id into sid from ids where n=i;
    r := private.claim_writing_check(sid,'d0000000-0000-4000-8000-000000000003');
    if r->>'status'<>'claimed' then raise exception 'Paid check % refused: %', i, r; end if;
  end loop;
  select id into sid from ids where n=9;
  r := private.claim_writing_check(sid,'d0000000-0000-4000-8000-000000000003');
  if r->>'status'<>'quota' then raise exception 'Monthly allowance missing: %', r; end if;

  -- Expired subscription counts as unpaid.
  update public.subscriptions set current_period_end=now()-interval '1 day' where student_id='d0000000-0000-4000-8000-000000000003';
  if (private.check_access('d0000000-0000-4000-8000-000000000003')->>'active')::boolean then raise exception 'Expired still active'; end if;

  -- Teachers never pay.
  for i in 11..12 loop
    select id into sid from ids where n=i;
    r := private.claim_writing_check(sid,'d0000000-0000-4000-8000-000000000002');
    if r->>'status'<>'claimed' then raise exception 'Teacher charged: %', r; end if;
  end loop;
end $$;

set local role authenticated;
-- Parent sees their child's access; cannot see another student's or grant access.
select set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-000000000005',true);
do $$ begin
  if (public.my_check_access('d0000000-0000-4000-8000-000000000004')->>'reason')<>'payment_required' then raise exception 'Parent view wrong'; end if;
  begin perform public.my_check_access('d0000000-0000-4000-8000-000000000003'); raise exception 'Parent saw other student';
  exception when raise_exception then if sqlerrm<>'Not allowed.' then raise; end if; end;
  begin perform public.admin_grant_access('d0000000-0000-4000-8000-000000000004',1,'x'); raise exception 'Parent granted access';
  exception when raise_exception then if sqlerrm not like 'Only the school admin%' then raise; end if; end;
  begin insert into public.subscriptions(student_id,status) values('d0000000-0000-4000-8000-000000000004','active'); raise exception 'Parent wrote a subscription';
  exception when insufficient_privilege then null; end;
end $$;
-- Admin gives a cash-paying student 2 months; the student can then check.
select set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-000000000001',true);
do $$ begin
  if public.admin_grant_access('d0000000-0000-4000-8000-000000000004',2,'Cash, term 4') < now()+interval '59 days' then raise exception 'Grant too short'; end if;
end $$;
reset role;
do $$ declare r jsonb; sid uuid; begin
  select id into sid from ids where n=3;
  r := private.claim_writing_check(sid,'d0000000-0000-4000-8000-000000000004');
  if r->>'status'<>'claimed' then raise exception 'Manual access refused: %', r; end if;
end $$;
-- Switching the paywall off frees everyone.
update public.school_settings set sub_required=false where id=1;
do $$ begin
  if not (private.check_access('d0000000-0000-4000-8000-000000000003')->>'allowed')::boolean then raise exception 'Paywall off still blocks'; end if;
end $$;
select 'PASS: trial, paywall, monthly allowance, expiry, teacher exempt, parent view, admin cash grant; fixtures rolled back' as result;
rollback;
