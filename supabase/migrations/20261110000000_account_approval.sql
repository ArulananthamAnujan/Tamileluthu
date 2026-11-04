-- Account approval: new student and parent accounts wait for the school admin
-- before they can use anything. Teachers are already approved through the
-- teacher email list, so their accounts are approved automatically.
-- Also: no made-up school name. The school's details stay empty until the
-- admin fills them in (Admin → School details).
-- Apply AFTER 20261109000000_share_teacher_checks.sql.

-- ---------------------------------------------------------------
-- School details start empty
-- ---------------------------------------------------------------
alter table public.school_settings drop constraint if exists school_settings_school_name_check;
alter table public.school_settings alter column school_name set default '';
alter table public.school_settings add constraint school_settings_school_name_check
  check (char_length(school_name) <= 120);
update public.school_settings set school_name = '' where school_name = 'Tamil School';

-- ---------------------------------------------------------------
-- The approved flag
-- ---------------------------------------------------------------
alter table public.profiles add column approved boolean not null default false;
alter table public.profiles add column approved_at timestamptz;
-- Everyone who already has an account keeps their access.
update public.profiles set approved = true, approved_at = now();
-- People cannot approve themselves: profiles only grants update on
-- full_name, phone and lang to signed-in users.

create function private.is_approved() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select approved from public.profiles where id = auth.uid()), false)
$$;
revoke all on function private.is_approved() from public, anon;
grant execute on function private.is_approved() to authenticated, service_role;

create function private.require_approved() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_approved() then
    raise exception 'Your account is waiting for the school to approve it.';
  end if;
end $$;
revoke all on function private.require_approved() from public, anon;
grant execute on function private.require_approved() to authenticated, service_role;

-- New sign-ups: teachers (already on the admin's list) are approved; students
-- and parents wait, and every admin gets a notification.
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
declare
  req text := coalesce(new.raw_user_meta_data->>'role', 'student');
  adm boolean := false;
  nm text := left(coalesce(new.raw_user_meta_data->>'full_name', ''), 120);
begin
  if req not in ('teacher','student','parent') then req := 'student'; end if;
  if req = 'teacher' then
    select t.is_admin into adm from public.teacher_emails t where lower(t.email) = lower(new.email);
    if not found then raise exception 'This email is not registered as a teacher.'; end if;
  end if;
  insert into public.profiles (id, full_name, role, parent_code, is_admin, approved, approved_at)
  values (new.id, nm, req,
          case when req = 'student' then public.gen_code(8) end,
          coalesce(adm, false),
          req = 'teacher',
          case when req = 'teacher' then now() end);
  if req <> 'teacher' then
    insert into public.notifications (user_id, kind, title, body, link)
    select p.id, 'system',
           left('New ' || req || ' waiting for approval: ' || coalesce(nullif(trim(nm), ''), new.email), 200),
           left(coalesce(new.email, ''), 500), '#/admin?tab=approvals'
      from public.profiles p where p.is_admin and p.role = 'teacher';
  end if;
  return new;
end $$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------
-- Database-level lock: until approved, a signed-in account can read only its
-- own profile and the public school details/paper catalogue, and can write nothing.
-- Restrictive policies are combined (AND) with every existing policy.
-- ---------------------------------------------------------------
do $$ declare tb text; begin
  foreach tb in array array['activities','activity_done','assessments','attendance','class_members','classes',
                            'marks','parent_links','purchases','reports','resources','submissions','subscriptions'] loop
    execute format('create policy %I on public.%I as restrictive for all to authenticated
                    using (private.is_approved()) with check (private.is_approved())', tb || '_approved_only', tb);
  end loop;
end $$;
create policy profiles_approved_only on public.profiles as restrictive for all to authenticated
  using (id = auth.uid() or private.is_approved()) with check (id = auth.uid() or private.is_approved());
create policy objects_approved_only on storage.objects as restrictive for all to authenticated
  using (bucket_id = 'branding' or private.is_approved())
  with check (private.is_approved());

-- Actions that run with elevated rights check approval first.
create or replace function public.join_class(code text) returns text
language plpgsql security invoker set search_path = '' as $$
begin perform private.require_approved(); return private.join_class(code); end $$;
create or replace function public.link_child(code text) returns text
language plpgsql security invoker set search_path = '' as $$
begin perform private.require_approved(); return private.link_child(code); end $$;
create or replace function public.new_parent_code() returns text
language plpgsql security invoker set search_path = '' as $$
begin perform private.require_approved(); return private.new_parent_code(); end $$;
create or replace function public.claim_free(pid uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin perform private.require_approved(); perform private.claim_free(pid); end $$;
create or replace function public.set_question(sub uuid, q text) returns void
language plpgsql security invoker set search_path = '' as $$
begin perform private.require_approved(); perform private.set_question(sub, q); end $$;
create or replace function public.my_check_access(sid uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
begin perform private.require_approved(); return private.my_check_access(sid); end $$;

-- ---------------------------------------------------------------
-- Admin: see, approve, decline and block student/parent accounts
-- ---------------------------------------------------------------
create function private.admin_accounts()
returns table (id uuid, email text, full_name text, role text, approved boolean, created_at timestamptz,
               classes text, children text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return query
    select p.id, u.email::text, p.full_name, p.role, p.approved, p.created_at,
           (select string_agg(c.name, ', ' order by c.name) from public.class_members m
              join public.classes c on c.id = m.class_id where m.student_id = p.id),
           (select string_agg(s.full_name, ', ' order by s.full_name) from public.parent_links pl
              join public.profiles s on s.id = pl.student_id where pl.parent_id = p.id)
      from public.profiles p join auth.users u on u.id = p.id
     where p.role in ('student', 'parent')
     order by p.approved, p.created_at desc;
end $$;

create function private.admin_set_approved(uid uuid, value boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  update public.profiles set approved = value, approved_at = case when value then now() end
   where id = uid and role in ('student', 'parent');
  if not found then raise exception 'Account not found.'; end if;
  if value then
    insert into public.notifications (user_id, kind, title, body, link)
    values (uid, 'system', 'Your account is approved. Welcome!', '', '#/today');
  end if;
end $$;

-- Decline: deletes a waiting account completely (it can sign up again later).
create function private.admin_decline(uid uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if not exists (select 1 from public.profiles where id = uid and role in ('student', 'parent') and not approved) then
    raise exception 'Only accounts that are waiting for approval can be declined.';
  end if;
  delete from auth.users where id = uid;
end $$;

revoke all on function private.admin_accounts(), private.admin_set_approved(uuid, boolean), private.admin_decline(uuid) from public, anon;
grant execute on function private.admin_accounts(), private.admin_set_approved(uuid, boolean), private.admin_decline(uuid) to authenticated, service_role;

create function public.admin_accounts()
returns table (id uuid, email text, full_name text, role text, approved boolean, created_at timestamptz,
               classes text, children text)
language sql security invoker set search_path = '' as $$ select * from private.admin_accounts() $$;
create function public.admin_set_approved(uid uuid, value boolean) returns void
language sql security invoker set search_path = '' as $$ select private.admin_set_approved(uid, value) $$;
create function public.admin_decline(uid uuid) returns void
language sql security invoker set search_path = '' as $$ select private.admin_decline(uid) $$;
revoke all on function public.admin_accounts(), public.admin_set_approved(uuid, boolean), public.admin_decline(uuid) from public, anon;
grant execute on function public.admin_accounts(), public.admin_set_approved(uuid, boolean), public.admin_decline(uuid) to authenticated, service_role;
