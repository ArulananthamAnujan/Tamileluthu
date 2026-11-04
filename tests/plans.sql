-- Subscription plans: each plan has its own monthly allowance and price.
-- All fixtures roll back.
begin;
insert into public.teacher_emails(email,is_admin) values('pl-admin@example.invalid',true),('pl-t@example.invalid',false);
insert into auth.users(id,email,raw_user_meta_data) values
('e1000000-0000-4000-8000-00000000000a','pl-admin@example.invalid','{"role":"teacher","full_name":"Admin"}'),
('e1000000-0000-4000-8000-000000000001','pl-t@example.invalid','{"role":"teacher","full_name":"T"}'),
('e1000000-0000-4000-8000-000000000002','pl-s1@example.invalid','{"role":"student","full_name":"Plus kid"}'),
('e1000000-0000-4000-8000-000000000003','pl-s2@example.invalid','{"role":"student","full_name":"Cash kid"}');
update public.profiles set approved = true where not approved; -- existing accounts are approved
update public.school_settings set sub_required=true, sub_trial_checks=1 where id=1;

do $$ begin
  if (select count(*) from public.sub_plans where active) <> 3 then raise exception 'Three starting plans expected'; end if;
  if (select checks_per_month||'/'||price_cents from public.sub_plans where id='basic') <> '6/4500' then raise exception 'Basic should be 6 checks for 45.00'; end if;
  if (select checks_per_month from public.sub_plans where id='plus') <> 20 then raise exception 'Plus should be 20 checks'; end if;
  if (select checks_per_month from public.sub_plans where id='premium') <> 35 then raise exception 'Premium should be 35 checks'; end if;
end $$;

-- A card subscriber on Plus gets 20 checks this period, then the allowance stops them.
insert into public.subscriptions(student_id,status,current_period_start,current_period_end,plan_id,checks_per_month,stripe_subscription_id)
values('e1000000-0000-4000-8000-000000000002','active',now()-interval '2 days',now()+interval '28 days','plus',20,'sub_test_plus');
create temp table subs_ids as select g n, gen_random_uuid() id from generate_series(1,21) g;
insert into public.submissions(id,student_id,input_mode,original_text)
select id,'e1000000-0000-4000-8000-000000000002','text','x' from subs_ids;
do $$ declare r jsonb; i int; sid uuid; begin
  r := private.check_access('e1000000-0000-4000-8000-000000000002');
  if r->>'plan_id'<>'plus' or (r->>'quota')::int<>20 then raise exception 'Plus access wrong: %', r; end if;
  for i in 1..20 loop
    select id into sid from subs_ids where n=i;
    r := private.claim_writing_check(sid,'e1000000-0000-4000-8000-000000000002');
    if r->>'status'<>'claimed' then raise exception 'Plus check % refused: %', i, r; end if;
  end loop;
  select id into sid from subs_ids where n=21;
  r := private.claim_writing_check(sid,'e1000000-0000-4000-8000-000000000002');
  if r->>'status'<>'quota' then raise exception '21st check should hit the Plus allowance: %', r; end if;
end $$;

-- Changing a plan's price or allowance later does not change existing subscriptions.
update public.sub_plans set checks_per_month = 25, price_cents = 15900 where id = 'plus';
do $$ begin
  if (private.check_access('e1000000-0000-4000-8000-000000000002')->>'quota')::int <> 20 then
    raise exception 'Existing subscriber should keep the allowance they paid for'; end if;
end $$;

set local role authenticated;
-- Everyone can read plans (they are shown before subscribing); only the admin edits them.
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000001',true);
do $$ begin
  if (select count(*) from public.sub_plans) < 3 then raise exception 'Teacher cannot read plans'; end if;
  update public.sub_plans set price_cents = 100 where id = 'basic';
  if (select price_cents from public.sub_plans where id = 'basic') = 100 then raise exception 'Non-admin changed a price'; end if;
  begin perform public.admin_grant_plan('e1000000-0000-4000-8000-000000000003','premium',1,'x'); raise exception 'GRANTED';
  exception when others then if sqlerrm='GRANTED' then raise exception 'Non-admin gave a plan'; end if; end;
end $$;
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-00000000000a',true);
do $$ declare until timestamptz; begin
  update public.sub_plans set price_cents = 4900 where id = 'basic';
  if (select price_cents from public.sub_plans where id = 'basic') <> 4900 then raise exception 'Admin could not change a price'; end if;
  insert into public.sub_plans(id,name,checks_per_month,price_cents,sort) values('family','Family',50,29900,4);
  -- Cash payment: 3 months of Premium.
  until := public.admin_grant_plan('e1000000-0000-4000-8000-000000000003','premium',3,'Cash, receipt 7');
  if until < now() + interval '89 days' then raise exception 'Grant too short'; end if;
  -- A card subscriber's plan is changed on their own page, not by a cash grant.
  begin perform public.admin_grant_plan('e1000000-0000-4000-8000-000000000002','basic',1,'x'); raise exception 'GRANTED';
  exception when others then if sqlerrm='GRANTED' then raise exception 'Cash grant overwrote a card subscription'; end if; end;
end $$;
reset role;
do $$ declare r jsonb; begin
  r := private.check_access('e1000000-0000-4000-8000-000000000003');
  if r->>'plan_id'<>'premium' or (r->>'quota')::int<>35 or not (r->>'active')::boolean then raise exception 'Cash Premium wrong: %', r; end if;
  -- In month 2 of a 3-month cash grant, only this month's checks count.
  update public.subscriptions set current_period_start = now() - interval '40 days' where student_id='e1000000-0000-4000-8000-000000000003';
  insert into public.submissions(id,student_id,input_mode,original_text)
  values('e1000000-0000-4000-8000-0000000000f1','e1000000-0000-4000-8000-000000000003','text','x');
  insert into private.check_attempts(student_id,submission_id,started_at)
  select 'e1000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-0000000000f1', now() - interval '35 days' from generate_series(1,35);
  r := private.check_access('e1000000-0000-4000-8000-000000000003');
  if (r->>'used')::int <> 0 or not (r->>'allowed')::boolean then raise exception 'Monthly count should restart each month: %', r; end if;
end $$;
select 'PASS: plans, per-plan allowance, price changes keep old terms, admin-only edits, cash grants per plan, monthly reset' as result;
rollback;
