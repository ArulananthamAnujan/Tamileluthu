-- Principal/admin role, school settings (name, logo, photo, contacts),
-- parent phone numbers for WhatsApp, language preference, and in-app notifications.
-- Apply AFTER 20261101000000_school_portal.sql.
--
-- Make the first admin (run once, with the principal's email):
--   update public.teacher_emails set is_admin = true where lower(email) = lower('principal@yourschool.org');
--   update public.profiles set is_admin = true
--    where id = (select id from auth.users where lower(email) = lower('principal@yourschool.org'));
-- After that the admin manages teachers and other admins from the website.

-- ---------------------------------------------------------------
-- Profile additions
-- ---------------------------------------------------------------
alter table public.teacher_emails add column is_admin boolean not null default false;
alter table public.profiles add column is_admin boolean not null default false;
alter table public.profiles add column phone text
  check (phone is null or phone ~ '^\+?[0-9][0-9 ()-]{5,19}$');
alter table public.profiles add column lang text not null default 'en' check (lang in ('en','ta'));
alter table public.profiles add constraint profiles_name_length check (char_length(full_name) <= 120) not valid;
grant update (full_name, phone, lang) on public.profiles to authenticated;

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
declare
  req text := coalesce(new.raw_user_meta_data->>'role', 'student');
  adm boolean := false;
begin
  if req not in ('teacher','student','parent') then req := 'student'; end if;
  if req = 'teacher' then
    select t.is_admin into adm from public.teacher_emails t where lower(t.email) = lower(new.email);
    if not found then raise exception 'This email is not registered as a teacher.'; end if;
  end if;
  insert into public.profiles (id, full_name, role, parent_code, is_admin)
  values (new.id,
          left(coalesce(new.raw_user_meta_data->>'full_name', ''), 120),
          req,
          case when req = 'student' then public.gen_code(8) end,
          coalesce(adm, false));
  return new;
end $$;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_admin and role = 'teacher' from public.profiles where id = auth.uid()), false)
$$;
create function private.is_parent_of_my_student(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.parent_links pl where pl.parent_id = pid and private.is_teacher_of(pl.student_id))
$$;
revoke all on function private.is_admin(), private.is_parent_of_my_student(uuid) from public, anon;
grant execute on function private.is_admin(), private.is_parent_of_my_student(uuid) to authenticated, service_role;

-- Teachers can see (name and phone of) the parents of their students, and the links.
create policy profiles_select_parent_of_my_student on public.profiles for select to authenticated
  using (private.is_parent_of_my_student(id));
create policy links_select_teacher on public.parent_links for select to authenticated
  using (private.is_teacher_of(student_id));

-- The admin (principal) can read school records across all classes. Writing stays with class teachers.
create policy profiles_select_admin on public.profiles for select to authenticated using (private.is_admin());
create policy classes_select_admin on public.classes for select to authenticated using (private.is_admin());
create policy members_select_admin on public.class_members for select to authenticated using (private.is_admin());
create policy links_select_admin on public.parent_links for select to authenticated using (private.is_admin());
create policy activities_select_admin on public.activities for select to authenticated using (private.is_admin());
create policy attendance_select_admin on public.attendance for select to authenticated using (private.is_admin());
create policy resources_select_admin on public.resources for select to authenticated using (private.is_admin());
create policy assessments_select_admin on public.assessments for select to authenticated using (private.is_admin());
create policy marks_select_admin on public.marks for select to authenticated using (private.is_admin());
create policy reports_select_admin on public.reports for select to authenticated using (private.is_admin());

-- ---------------------------------------------------------------
-- Admin actions (teacher allow-list, admins, moving a class)
-- ---------------------------------------------------------------
create function private.require_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Only the school admin can do this.'; end if;
end $$;

create function private.admin_staff()
returns table (email text, is_admin boolean, user_id uuid, full_name text, classes bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return query
    select t.email, t.is_admin, p.id, p.full_name,
           (select count(*) from public.classes c where c.teacher_id = p.id)
      from public.teacher_emails t
      left join auth.users u on lower(u.email) = lower(t.email)
      left join public.profiles p on p.id = u.id and p.role = 'teacher'
     order by lower(t.email);
end $$;

create function private.admin_add_teacher(new_email text, make_admin boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare e text := lower(trim(new_email));
begin
  perform private.require_admin();
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(e) > 200 then raise exception 'That email does not look right.'; end if;
  insert into public.teacher_emails(email, is_admin) values (e, coalesce(make_admin, false))
  on conflict (email) do update set is_admin = excluded.is_admin;
  update public.profiles set is_admin = coalesce(make_admin, false)
   where role = 'teacher' and id in (select id from auth.users where lower(email) = e);
end $$;

create function private.admin_remove_teacher(old_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare e text := lower(trim(old_email));
begin
  perform private.require_admin();
  if e = (select lower(email) from auth.users where id = auth.uid()) then
    raise exception 'You cannot remove yourself.';
  end if;
  delete from public.teacher_emails where lower(email) = e;
  update public.profiles set is_admin = false where id in (select id from auth.users where lower(email) = e);
end $$;

create function private.admin_set_admin(target_email text, value boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare e text := lower(trim(target_email));
begin
  perform private.require_admin();
  if not value and e = (select lower(email) from auth.users where id = auth.uid()) then
    raise exception 'You cannot remove your own admin access.';
  end if;
  update public.teacher_emails set is_admin = value where lower(email) = e;
  if not found then raise exception 'Add this email as a teacher first.'; end if;
  update public.profiles set is_admin = value
   where role = 'teacher' and id in (select id from auth.users where lower(email) = e);
end $$;

create function private.admin_reassign_class(cid uuid, teacher_email text) returns text
language plpgsql security definer set search_path = '' as $$
declare t record;
begin
  perform private.require_admin();
  select p.id, p.full_name into t from auth.users u join public.profiles p on p.id = u.id
   where lower(u.email) = lower(trim(teacher_email)) and p.role = 'teacher';
  if t.id is null then raise exception 'No teacher account uses that email.'; end if;
  update public.classes set teacher_id = t.id where id = cid;
  if not found then raise exception 'Class not found.'; end if;
  return t.full_name;
end $$;

do $$ declare f text; begin
  foreach f in array array['require_admin()','admin_staff()','admin_add_teacher(text,boolean)',
                           'admin_remove_teacher(text)','admin_set_admin(text,boolean)','admin_reassign_class(uuid,text)'] loop
    execute format('revoke all on function private.%s from public, anon', f);
    execute format('grant execute on function private.%s to authenticated, service_role', f);
  end loop;
end $$;

create function public.admin_staff()
returns table (email text, is_admin boolean, user_id uuid, full_name text, classes bigint)
language sql security invoker set search_path = '' as $$ select * from private.admin_staff() $$;
create function public.admin_add_teacher(new_email text, make_admin boolean) returns void
language sql security invoker set search_path = '' as $$ select private.admin_add_teacher(new_email, make_admin) $$;
create function public.admin_remove_teacher(old_email text) returns void
language sql security invoker set search_path = '' as $$ select private.admin_remove_teacher(old_email) $$;
create function public.admin_set_admin(target_email text, value boolean) returns void
language sql security invoker set search_path = '' as $$ select private.admin_set_admin(target_email, value) $$;
create function public.admin_reassign_class(cid uuid, teacher_email text) returns text
language sql security invoker set search_path = '' as $$ select private.admin_reassign_class(cid, teacher_email) $$;
revoke all on function public.admin_staff(), public.admin_add_teacher(text,boolean), public.admin_remove_teacher(text),
  public.admin_set_admin(text,boolean), public.admin_reassign_class(uuid,text) from public, anon;
grant execute on function public.admin_staff(), public.admin_add_teacher(text,boolean), public.admin_remove_teacher(text),
  public.admin_set_admin(text,boolean), public.admin_reassign_class(uuid,text) to authenticated, service_role;

-- ---------------------------------------------------------------
-- School settings: one row, readable by everyone, edited by the admin
-- ---------------------------------------------------------------
create table public.school_settings (
  id             int primary key default 1 check (id = 1),
  school_name    text not null default 'Tamil School' check (char_length(trim(school_name)) between 1 and 120),
  school_name_ta text not null default '' check (char_length(school_name_ta) <= 120),
  tagline        text not null default '' check (char_length(tagline) <= 400),
  about          text not null default '' check (char_length(about) <= 3000),
  contact_email  text check (contact_email is null or (contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(contact_email) <= 200)),
  contact_phone  text check (contact_phone is null or char_length(contact_phone) <= 40),
  address        text check (address is null or char_length(address) <= 300),
  whatsapp_url   text check (whatsapp_url is null or (whatsapp_url ~* '^https://(chat\.whatsapp\.com|wa\.me|whatsapp\.com)/' and char_length(whatsapp_url) <= 300)),
  logo_path      text check (logo_path is null or char_length(logo_path) <= 300),
  hero_path      text check (hero_path is null or char_length(hero_path) <= 300),
  updated_at     timestamptz not null default now()
);
insert into public.school_settings (id) values (1);
alter table public.school_settings enable row level security;
create policy settings_select on public.school_settings for select to anon, authenticated using (true);
create policy settings_update on public.school_settings for update to authenticated
  using (private.is_admin()) with check (private.is_admin());
revoke all on public.school_settings from anon, authenticated;
grant select on public.school_settings to anon, authenticated;
grant update (school_name, school_name_ta, tagline, about, contact_email, contact_phone, address,
              whatsapp_url, logo_path, hero_path, updated_at) on public.school_settings to authenticated;
grant all on public.school_settings to service_role;

-- Public images (logo, school photo). Anyone can view; only the admin uploads.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('branding', 'branding', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy branding_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'branding' and private.is_admin());
create policy branding_delete on storage.objects for delete to authenticated
  using (bucket_id = 'branding' and private.is_admin());

-- ---------------------------------------------------------------
-- In-app notifications (bell)
-- ---------------------------------------------------------------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles on delete cascade,
  student_id uuid references public.profiles on delete cascade,
  kind       text not null check (kind in ('activity','resource','marks','report','comment','system')),
  title      text not null,
  body       text not null default '',
  link       text not null default '',
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index notifications_user on public.notifications(user_id, created_at desc);
alter table public.notifications enable row level security;
create policy notifications_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete to authenticated using (user_id = auth.uid());
revoke all on public.notifications from anon, authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;

-- Send one notification to each student and each of their linked parents.
create function private.notify_students(sids uuid[], k text, t text, b text, l text) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, student_id, kind, title, body, link)
  select s, s, k, left(t, 200), left(coalesce(b, ''), 500), l from unnest(sids) s
  union all
  select pl.parent_id, pl.student_id, k, left(p.full_name || ': ' || t, 200), left(coalesce(b, ''), 500), l
    from public.parent_links pl join public.profiles p on p.id = pl.student_id
   where pl.student_id = any (sids)
$$;
revoke all on function private.notify_students(uuid[], text, text, text, text) from public, anon, authenticated;

create function private.class_students(cid uuid) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(student_id), '{}') from public.class_members where class_id = cid
$$;
revoke all on function private.class_students(uuid) from public, anon, authenticated;

create function private.on_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify_students(private.class_students(new.class_id), 'activity',
    case new.kind when 'homework' then 'Homework: ' when 'announcement' then 'Notice: '
                  when 'event' then 'Event: ' when 'reminder' then 'Reminder: ' else 'Classwork: ' end || new.title,
    new.body, '#/diary');
  return new;
end $$;
create trigger activities_notify after insert on public.activities for each row execute function private.on_activity();

create function private.on_resource() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify_students(private.class_students(new.class_id), 'resource',
    case when new.kind = 'listening' then 'New listening exam: ' else 'New resource: ' end || new.title,
    new.description, '#/listening');
  return new;
end $$;
create trigger resources_notify after insert on public.resources for each row execute function private.on_resource();

create function private.on_assessment_published() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.published and (tg_op = 'INSERT' or not old.published) then
    perform private.notify_students(
      (select coalesce(array_agg(student_id), '{}') from public.marks where assessment_id = new.id),
      'marks', 'New result: ' || new.title, '', '#/marks');
  end if;
  return new;
end $$;
create trigger assessments_notify after insert or update of published on public.assessments
  for each row execute function private.on_assessment_published();

create function private.on_report_published() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.published and (tg_op = 'INSERT' or not old.published) then
    perform private.notify_students(array[new.student_id], 'report', 'Report ready: ' || new.term, '', '#/reports');
  end if;
  return new;
end $$;
create trigger reports_notify after insert or update of published on public.reports
  for each row execute function private.on_report_published();

create function private.on_teacher_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.teacher_comment is not null and new.teacher_comment is distinct from old.teacher_comment then
    perform private.notify_students(array[new.student_id], 'comment',
      'Teacher commented on: ' || coalesce(nullif(new.title, ''), 'writing'), new.teacher_comment, '#/writing');
  end if;
  return new;
end $$;
create trigger submissions_comment_notify after update of teacher_comment on public.submissions
  for each row execute function private.on_teacher_comment();

do $$ declare f text; begin
  foreach f in array array['on_activity()','on_resource()','on_assessment_published()','on_report_published()','on_teacher_comment()'] loop
    execute format('revoke all on function private.%s from public, anon, authenticated', f);
  end loop;
end $$;

notify pgrst, 'reload schema';
