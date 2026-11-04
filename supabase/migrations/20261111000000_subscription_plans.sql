-- Subscription plans: several monthly plans (e.g. 6, 20 or 35 checks), each
-- with its own price. The admin edits them under Admin → Subscriptions.
-- Each subscription remembers its plan and its monthly check allowance, so a
-- later price or allowance change only affects new subscriptions.
-- Apply AFTER 20261110000000_account_approval.sql.

create table public.sub_plans (
  id               text primary key check (id ~ '^[a-z0-9_-]{1,30}$'),
  name             text not null check (char_length(trim(name)) between 1 and 60),
  name_ta          text not null default '' check (char_length(name_ta) <= 60),
  checks_per_month int  not null check (checks_per_month between 1 and 100000),
  price_cents      int  not null check (price_cents between 50 and 10000000),
  active           boolean not null default true,
  sort             int  not null default 0,
  updated_at       timestamptz not null default now()
);
-- Starting prices (AUD, at a cost of about US$3 per check); the admin can change them.
insert into public.sub_plans (id, name, name_ta, checks_per_month, price_cents, sort) values
  ('basic',   'Basic',   'அடிப்படை', 6,  4500,  1),
  ('plus',    'Plus',    'கூடுதல்',   20, 13900, 2),
  ('premium', 'Premium', 'சிறப்பு',   35, 22900, 3);

alter table public.sub_plans enable row level security;
create policy plans_select on public.sub_plans for select to anon, authenticated using (true);
create policy plans_admin_insert on public.sub_plans for insert to authenticated with check (private.is_admin());
create policy plans_admin_update on public.sub_plans for update to authenticated
  using (private.is_admin()) with check (private.is_admin());
revoke all on public.sub_plans from anon, authenticated;
grant select on public.sub_plans to anon, authenticated;
grant insert (id, name, name_ta, checks_per_month, price_cents, active, sort, updated_at),
      update (name, name_ta, checks_per_month, price_cents, active, sort, updated_at)
  on public.sub_plans to authenticated;
grant all on public.sub_plans to service_role;
-- Plans are never deleted (old subscriptions point at them); the admin hides them instead.

alter table public.subscriptions
  add column plan_id text references public.sub_plans on delete set null,
  add column checks_per_month int check (checks_per_month is null or checks_per_month between 1 and 100000);
-- Anyone already subscribed was paying the single price; put them on Basic.
update public.subscriptions set plan_id = 'basic', checks_per_month = 6 where plan_id is null;

-- Access and monthly usage, now per plan.
create or replace function private.check_access(owner uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare st record; sub public.subscriptions; p_role text; used_total int; used_period int; since timestamptz;
        active boolean; quota int; plan public.sub_plans;
begin
  select p.role into p_role from public.profiles p where p.id = owner;
  select coalesce(sub_required, true) req, coalesce(sub_currency, 'aud') cur, coalesce(sub_trial_checks, 0) trial
    into st from public.school_settings where id = 1;
  if p_role = 'teacher' or not coalesce(st.req, true) then
    return jsonb_build_object('allowed', true, 'required', false);
  end if;
  select * into sub from public.subscriptions where student_id = owner;
  active := sub.student_id is not null and sub.status in ('active', 'manual', 'past_due')
            and (sub.current_period_end is null or sub.current_period_end > now());
  select * into plan from public.sub_plans where id = sub.plan_id;
  -- The allowance saved with the subscription; else its plan's; else the smallest active plan.
  quota := coalesce(sub.checks_per_month, plan.checks_per_month,
                    (select p.checks_per_month from public.sub_plans p where p.active order by p.sort, p.price_cents limit 1), 0);
  select count(*) into used_total from private.check_attempts where student_id = owner;
  since := coalesce(sub.current_period_start, sub.current_period_end - interval '1 month', now() - interval '1 month');
  -- Months given by hand can cover several months: count from the start of the current month of it.
  if since < now() - interval '1 month' then
    since := since + make_interval(months => (extract(year from age(now(), since)) * 12
                                              + extract(month from age(now(), since)))::int);
  end if;
  select count(*) into used_period from private.check_attempts where student_id = owner and started_at >= since;
  return jsonb_build_object(
    'required', true,
    'active', active,
    'status', sub.status,
    'period_end', sub.current_period_end,
    'plan_id', case when active then sub.plan_id end,
    'plan_name', case when active then plan.name end,
    'plan_name_ta', case when active then plan.name_ta end,
    'currency', st.cur,
    'quota', case when active then quota else 0 end,
    'used', case when active then used_period else 0 end,
    'trial_left', greatest(st.trial - used_total, 0),
    'allowed', (active and (quota = 0 or used_period < quota)) or (not active and used_total < st.trial),
    'reason', case
      when active and quota > 0 and used_period >= quota then 'quota'
      when not active and used_total >= st.trial then 'payment_required'
      else null end
  );
end $$;
revoke all on function private.check_access(uuid) from public, anon, authenticated;
grant execute on function private.check_access(uuid) to service_role;

-- Admin: give a plan for cash/bank payments (0 months removes access given by hand).
create function private.admin_grant_plan(sid uuid, plan text, months int, memo text) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare until timestamptz; cur public.subscriptions; p public.sub_plans;
begin
  perform private.require_admin();
  if not exists (select 1 from public.profiles where id = sid and role = 'student') then raise exception 'Student not found.'; end if;
  if months is null or months < 0 or months > 24 then raise exception 'Choose 0 to 24 months.'; end if;
  if months = 0 then
    update public.subscriptions set status = 'canceled', current_period_end = now(), updated_at = now(), note = left(memo, 200)
     where student_id = sid and stripe_subscription_id is null;
    return now();
  end if;
  select * into p from public.sub_plans where id = plan;
  if not found then raise exception 'Choose a plan.'; end if;
  select * into cur from public.subscriptions where student_id = sid;
  if cur.stripe_subscription_id is not null and cur.status in ('active', 'past_due') then
    raise exception 'This student pays by card. Change their plan from their Subscription page, or cancel it in Stripe first.';
  end if;
  until := greatest(coalesce(cur.current_period_end, now()), now()) + make_interval(months => months);
  insert into public.subscriptions(student_id, status, current_period_start, current_period_end, paid_by, note,
                                   plan_id, checks_per_month, updated_at)
  values (sid, 'manual', now(), until, auth.uid(), left(memo, 200), p.id, p.checks_per_month, now())
  on conflict (student_id) do update set
    status = 'manual',
    current_period_start = case when public.subscriptions.status = 'manual'
                                 and public.subscriptions.current_period_end > now()
                                then public.subscriptions.current_period_start else now() end,
    current_period_end = excluded.current_period_end, note = excluded.note,
    plan_id = excluded.plan_id, checks_per_month = excluded.checks_per_month,
    paid_by = excluded.paid_by, updated_at = now();
  return until;
end $$;
revoke all on function private.admin_grant_plan(uuid, text, int, text) from public, anon, authenticated;
grant execute on function private.admin_grant_plan(uuid, text, int, text) to authenticated, service_role;
create function public.admin_grant_plan(sid uuid, plan text, months int, memo text) returns timestamptz
language sql security invoker set search_path = '' as $$ select private.admin_grant_plan(sid, plan, months, memo) $$;
revoke all on function public.admin_grant_plan(uuid, text, int, text) from public, anon;
grant execute on function public.admin_grant_plan(uuid, text, int, text) to authenticated, service_role;

-- The old single-price grant now gives the smallest active plan.
create or replace function private.admin_grant_access(sid uuid, months int, memo text) returns timestamptz
language plpgsql security definer set search_path = '' as $$
begin
  return private.admin_grant_plan(sid,
    (select id from public.sub_plans where active order by sort, price_cents limit 1), months, memo);
end $$;

notify pgrst, 'reload schema';
