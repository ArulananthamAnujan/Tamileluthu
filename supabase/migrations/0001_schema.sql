-- Tamil Thiruthi — database, roles and privacy rules
-- Run this once in Supabase: Dashboard → SQL Editor → paste → Run.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------
-- Teacher allow-list: only these emails can sign up as a teacher.
-- Add yours after running this file, e.g.
--   insert into public.teacher_emails(email) values ('you@example.com');
-- ---------------------------------------------------------------
create table public.teacher_emails (
  email text primary key
);
alter table public.teacher_emails enable row level security;
-- no policies: nobody can read or change it from the website.

-- Short random codes (no 0/O/1/I to avoid confusion)
create or replace function public.gen_code(n int)
returns text language plpgsql volatile
set search_path = public, extensions
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  r text := '';
  i int;
begin
  for i in 1..n loop
    r := r || substr(chars, 1 + (get_byte(gen_random_bytes(1), 0) % 32), 1);
  end loop;
  return r;
end $$;

-- ---------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  full_name   text not null default '',
  role        text not null check (role in ('teacher','student','parent')),
  parent_code text unique,               -- students only: given to parents to link
  created_at  timestamptz not null default now()
);

create table public.classes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  teacher_id  uuid not null references public.profiles on delete cascade default auth.uid(),
  join_code   text not null unique default public.gen_code(6),
  created_at  timestamptz not null default now()
);

create table public.class_members (
  class_id    uuid not null references public.classes on delete cascade,
  student_id  uuid not null references public.profiles on delete cascade,
  joined_at   timestamptz not null default now(),
  primary key (class_id, student_id)
);

create table public.parent_links (
  parent_id   uuid not null references public.profiles on delete cascade,
  student_id  uuid not null references public.profiles on delete cascade,
  linked_at   timestamptz not null default now(),
  primary key (parent_id, student_id)
);

create table public.submissions (
  id                 uuid primary key default gen_random_uuid(),
  student_id         uuid not null references public.profiles on delete cascade default auth.uid(),
  title              text not null default '',
  text_type          text not null default 'general',
  input_mode         text not null default 'text' check (input_mode in ('photo','text')),
  photo_paths        text[] not null default '{}',
  original_text      text,
  status             text not null default 'pending' check (status in ('pending','checking','checked','error')),
  error              text,
  issues             jsonb not null default '[]',
  summary            text,
  focus              text,
  handwriting        jsonb not null default '[]',
  unclear            jsonb not null default '[]',
  teacher_comment    text,
  teacher_comment_at timestamptz,
  created_at         timestamptz not null default now(),
  checked_at         timestamptz
);
create index submissions_student_idx on public.submissions(student_id, created_at desc);
create index class_members_student_idx on public.class_members(student_id);
create index parent_links_student_idx on public.parent_links(student_id);

-- ---------------------------------------------------------------
-- New account → profile. Teacher role only for allow-listed emails.
-- ---------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
declare
  req text := coalesce(new.raw_user_meta_data->>'role', 'student');
begin
  if req not in ('teacher','student','parent') then req := 'student'; end if;
  if req = 'teacher' and not exists (
       select 1 from public.teacher_emails t where lower(t.email) = lower(new.email)) then
    raise exception 'This email is not registered as a teacher.';
  end if;
  insert into public.profiles (id, full_name, role, parent_code)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', ''),
          req,
          case when req = 'student' then public.gen_code(8) end);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------
-- Access helpers (security definer so policies don't recurse)
-- ---------------------------------------------------------------
create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_teacher_of(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.class_members m
    join public.classes c on c.id = m.class_id
    where m.student_id = sid and c.teacher_id = auth.uid())
$$;

create or replace function public.is_parent_of(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.parent_links
                 where parent_id = auth.uid() and student_id = sid)
$$;

create or replace function public.can_view_student(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select sid = auth.uid() or public.is_teacher_of(sid) or public.is_parent_of(sid)
$$;

create or replace function public.is_class_member(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.class_members where class_id = cid and student_id = auth.uid())
$$;

create or replace function public.is_class_teacher(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.classes where id = cid and teacher_id = auth.uid())
$$;

create or replace function public.teaches_me(tid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.classes c join public.class_members m on m.class_id = c.id
                 where c.teacher_id = tid and m.student_id = auth.uid())
$$;

create or replace function public.is_my_parent(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.parent_links where parent_id = pid and student_id = auth.uid())
$$;

create or replace function public.is_teacher_email(e text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.teacher_emails where lower(email) = lower(e))
$$;

-- ---------------------------------------------------------------
-- Actions done through functions (so codes stay private)
-- ---------------------------------------------------------------
create or replace function public.join_class(code text)
returns text language plpgsql security definer set search_path = public as $$
declare c record;
begin
  if public.my_role() is distinct from 'student' then
    raise exception 'Only students can join a class.';
  end if;
  select id, name into c from public.classes where join_code = upper(trim(code));
  if c.id is null then raise exception 'No class has that code.'; end if;
  insert into public.class_members(class_id, student_id) values (c.id, auth.uid())
  on conflict do nothing;
  return c.name;
end $$;

create or replace function public.link_child(code text)
returns text language plpgsql security definer set search_path = public as $$
declare s record;
begin
  if public.my_role() is distinct from 'parent' then
    raise exception 'Only parent accounts can link to a student.';
  end if;
  select id, full_name into s from public.profiles
   where role = 'student' and parent_code = upper(trim(code));
  if s.id is null then raise exception 'No student has that parent code.'; end if;
  insert into public.parent_links(parent_id, student_id) values (auth.uid(), s.id)
  on conflict do nothing;
  return s.full_name;
end $$;

create or replace function public.new_parent_code()
returns text language plpgsql security definer set search_path = public as $$
declare c text := public.gen_code(8);
begin
  if public.my_role() is distinct from 'student' then
    raise exception 'Only students have a parent code.';
  end if;
  update public.profiles set parent_code = c where id = auth.uid();
  return c;
end $$;

create or replace function public.set_teacher_comment(sub uuid, comment text)
returns void language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  select student_id into sid from public.submissions where id = sub;
  if sid is null or not public.is_teacher_of(sid) then
    raise exception 'You can only comment on your own students'' work.';
  end if;
  update public.submissions
     set teacher_comment = nullif(trim(comment), ''), teacher_comment_at = now()
   where id = sub;
end $$;

-- ---------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.classes       enable row level security;
alter table public.class_members enable row level security;
alter table public.parent_links  enable row level security;
alter table public.submissions   enable row level security;

-- profiles: yourself, students you teach or parent, parents linked to you,
-- and the teacher of a class you are in.
create policy profiles_select on public.profiles for select using (
  id = auth.uid()
  or public.can_view_student(id)
  or public.is_my_parent(id)
  or public.teaches_me(id)
);
create policy profiles_update on public.profiles for update using (id = auth.uid());
revoke update on public.profiles from authenticated, anon;
grant update (full_name) on public.profiles to authenticated;

-- classes
create policy classes_select on public.classes for select using (
  teacher_id = auth.uid() or public.is_class_member(id)
);
create policy classes_insert on public.classes for insert
  with check (teacher_id = auth.uid() and public.my_role() = 'teacher');
create policy classes_update on public.classes for update using (teacher_id = auth.uid());
create policy classes_delete on public.classes for delete using (teacher_id = auth.uid());
revoke update on public.classes from authenticated, anon;
grant update (name) on public.classes to authenticated;

-- class_members (joining happens through join_class)
create policy members_select on public.class_members for select using (
  student_id = auth.uid() or public.is_class_teacher(class_id)
);
create policy members_delete on public.class_members for delete using (
  student_id = auth.uid() or public.is_class_teacher(class_id)
);
revoke insert, update on public.class_members from authenticated, anon;

-- parent_links (linking happens through link_child)
create policy links_select on public.parent_links for select
  using (parent_id = auth.uid() or student_id = auth.uid());
create policy links_delete on public.parent_links for delete
  using (parent_id = auth.uid() or student_id = auth.uid());
revoke insert, update on public.parent_links from authenticated, anon;

-- submissions: students create their own; results are written only by the
-- checking function (service role); teachers comment through set_teacher_comment.
create policy subs_select on public.submissions for select using (public.can_view_student(student_id));
create policy subs_insert on public.submissions for insert
  with check (student_id = auth.uid() and public.my_role() = 'student');
create policy subs_delete on public.submissions for delete using (student_id = auth.uid());
revoke insert, update on public.submissions from authenticated, anon;
grant insert (student_id, title, text_type, input_mode, photo_paths, original_text)
  on public.submissions to authenticated;

-- ---------------------------------------------------------------
-- Photo storage: private bucket, one folder per student
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('writing', 'writing', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy writing_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'writing' and (storage.foldername(name))[1] = auth.uid()::text);
create policy writing_select on storage.objects for select to authenticated
  using (bucket_id = 'writing' and public.can_view_student(((storage.foldername(name))[1])::uuid));
create policy writing_delete on storage.objects for delete to authenticated
  using (bucket_id = 'writing' and (storage.foldername(name))[1] = auth.uid()::text);
