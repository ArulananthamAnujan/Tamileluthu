-- Paid monthly access to the தமிழ் திருத்தி writing checker, per student.
-- Apply AFTER 20261104000000_unlimited_checks.sql.
-- Teachers never need a subscription. Everything else in the portal stays free.

alter table public.school_settings
  add column sub_required boolean not null default true,
  add column sub_price_cents int not null default 4500 check (sub_price_cents between 50 and 10000000),
  add column sub_currency text not null default 'aud' check (sub_currency ~ '^[a-z]{3}$'),
  add column sub_checks_per_month int not null default 0 check (sub_checks_per_month between 0 and 100000),
  add column sub_trial_checks int not null default 3 check (sub_trial_checks between 0 and 1000);
grant update (sub_required, sub_price_cents, sub_currency, sub_checks_per_month, sub_trial_checks)
  on public.school_settings to authenticated;

create table public.subscriptions (
  student_id             uuid primary key references public.profiles on delete cascade,
  status                 text not null check (status in ('active','past_due','canceled','manual')),
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  stripe_customer_id     text,
  stripe_subscription_id text unique,
  paid_by                uuid references public.profiles on delete set null,
  note                   text check (note is null or char_length(note) <= 200),
  updated_at             timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy subs_plan_select on public.subscriptions for select to authenticated
  using (private.is_self_or_parent(student_id) or private.is_teacher_of(student_id) or private.is_admin());
revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;

-- Access and monthly usage for one person, used by the checker and the screens.
create function private.check_access(owner uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare st record; sub public.subscriptions; p_role text; used_total int; used_period int; since timestamptz; active boolean;
begin
  select p.role into p_role from public.profiles p where p.id = owner;
  select coalesce(sub_required, true) req, coalesce(sub_price_cents, 4500) price, coalesce(sub_currency, 'aud') cur,
         coalesce(sub_checks_per_month, 0) quota, coalesce(sub_trial_checks, 0) trial
    into st from public.school_settings where id = 1;
  if p_role = 'teacher' or not coalesce(st.req, true) then
    return jsonb_build_object('allowed', true, 'required', false);
  end if;
  select * into sub from public.subscriptions where student_id = owner;
  active := sub.student_id is not null and sub.status in ('active', 'manual', 'past_due')
            and (sub.current_period_end is null or sub.current_period_end > now());
  select count(*) into used_total from private.check_attempts where student_id = owner;
  since := coalesce(sub.current_period_start, sub.current_period_end - interval '1 month', now() - interval '1 month');
  select count(*) into used_period from private.check_attempts where student_id = owner and started_at >= since;
  return jsonb_build_object(
    'required', true,
    'active', active,
    'status', sub.status,
    'period_end', sub.current_period_end,
    'price_cents', st.price, 'currency', st.cur,
    'quota', st.quota, 'used', case when active then used_period else 0 end,
    'trial_left', greatest(st.trial - used_total, 0),
    'allowed', (active and (st.quota = 0 or used_period < st.quota)) or (not active and used_total < st.trial),
    'reason', case
      when active and st.quota > 0 and used_period >= st.quota then 'quota'
      when not active and used_total >= st.trial then 'payment_required'
      else null end
  );
end $$;
revoke all on function private.check_access(uuid) from public, anon, authenticated;
grant execute on function private.check_access(uuid) to service_role;

-- The screens may ask about themselves or a child/student they can see.
create function private.my_check_access(sid uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (private.is_self_or_parent(sid) or private.is_teacher_of(sid) or private.is_admin()) then
    raise exception 'Not allowed.';
  end if;
  return private.check_access(sid);
end $$;
revoke all on function private.my_check_access(uuid) from public, anon, authenticated;
grant execute on function private.my_check_access(uuid) to authenticated, service_role;
create function public.my_check_access(sid uuid) returns jsonb language sql security invoker set search_path = ''
  as $$ select private.my_check_access(sid) $$;
revoke all on function public.my_check_access(uuid) from public, anon;
grant execute on function public.my_check_access(uuid) to authenticated, service_role;

-- Admin: give access for cash/bank payments, or remove it.
create function private.admin_grant_access(sid uuid, months int, memo text) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare until timestamptz; cur public.subscriptions;
begin
  perform private.require_admin();
  if not exists (select 1 from public.profiles where id = sid and role = 'student') then raise exception 'Student not found.'; end if;
  if months is null or months < 0 or months > 24 then raise exception 'Choose 0 to 24 months.'; end if;
  select * into cur from public.subscriptions where student_id = sid;
  if months = 0 then
    update public.subscriptions set status = 'canceled', current_period_end = now(), updated_at = now(), note = left(memo, 200)
     where student_id = sid and stripe_subscription_id is null;
    return now();
  end if;
  until := greatest(coalesce(cur.current_period_end, now()), now()) + make_interval(months => months);
  insert into public.subscriptions(student_id, status, current_period_start, current_period_end, paid_by, note, updated_at)
  values (sid, 'manual', now(), until, auth.uid(), left(memo, 200), now())
  on conflict (student_id) do update set
    status = case when public.subscriptions.stripe_subscription_id is not null and public.subscriptions.status = 'active' then 'active' else 'manual' end,
    current_period_start = coalesce(public.subscriptions.current_period_start, now()),
    current_period_end = excluded.current_period_end, note = excluded.note, updated_at = now();
  return until;
end $$;
revoke all on function private.admin_grant_access(uuid, int, text) from public, anon, authenticated;
grant execute on function private.admin_grant_access(uuid, int, text) to authenticated, service_role;
create function public.admin_grant_access(sid uuid, months int, memo text) returns timestamptz language sql security invoker set search_path = ''
  as $$ select private.admin_grant_access(sid, months, memo) $$;
revoke all on function public.admin_grant_access(uuid, int, text) from public, anon;
grant execute on function public.admin_grant_access(uuid, int, text) to authenticated, service_role;

-- The checker refuses to start without access (enforced in the database, not just the website).
create or replace function private.claim_writing_check(sid uuid, owner uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.submissions; token uuid; lim record; acc jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(sid::text,0));
 select * into s from public.submissions where id=sid and student_id=owner for update;
 if not found then return jsonb_build_object('status','forbidden'); end if;
 if s.status='checked' then return jsonb_build_object('status','checked'); end if;
 if s.status='checking' and s.check_started_at>now()-interval '5 minutes' then
  return jsonb_build_object('status','checking'); end if;
 acc := private.check_access(owner);
 if not coalesce((acc->>'allowed')::boolean, false) then
  return jsonb_build_object('status', coalesce(acc->>'reason','payment_required'), 'access', acc); end if;
 select coalesce(check_limit_hour,0) h, coalesce(check_limit_day,0) d, coalesce(check_limit_per_writing,0) w
   into lim from public.school_settings where id=1;
 if (lim.h>0 and (select count(*) from private.check_attempts where student_id=owner and started_at>now()-interval '1 hour')>=lim.h)
 or (lim.d>0 and (select count(*) from private.check_attempts where student_id=owner and started_at>now()-interval '1 day')>=lim.d)
 or (lim.w>0 and (select count(*) from private.check_attempts where submission_id=sid)>=lim.w) then
  return jsonb_build_object('status','limited'); end if;
 insert into private.check_attempts(student_id,submission_id) values(owner,sid) returning id into token;
 update public.submissions set status='checking',error=null,check_started_at=now(),check_token=token where id=sid;
 return jsonb_build_object('status','claimed','token',token);
end $$;
revoke all on function private.claim_writing_check(uuid,uuid) from public,anon,authenticated;
grant execute on function private.claim_writing_check(uuid,uuid) to service_role;

notify pgrst, 'reload schema';
