-- Homework files and YouTube videos in the diary, and practice games.
-- Apply AFTER 20261111000000_subscription_plans.sql, then apply
-- 20261115000001_practice_workbook.sql to load the VCE writing workbook games.
--
-- Practice games are hidden by default:
--   1. only school admins can see a game;
--   2. an admin gives it to chosen teachers;
--   3. a teacher releases it to a class, and only then can students play it.
-- Every rule is enforced here with row level security, not in the website.

-- ---------------------------------------------------------------
-- Diary: attached files and a YouTube video on each post
-- ---------------------------------------------------------------
alter table public.activities
  add column video_url text
    check (video_url is null or (char_length(video_url) <= 300 and video_url ~*
      '^https://((www\.|m\.)?youtube\.com/(watch\?|shorts/|embed/|live/)|youtu\.be/|www\.youtube-nocookie\.com/embed/)')),
  add column attachments jsonb not null default '[]';

-- Each attachment is { path, name, size } and must sit in this class's folder.
create function private.check_activity_files() returns trigger
language plpgsql set search_path = '' as $$
declare f jsonb;
begin
  if jsonb_typeof(new.attachments) <> 'array' or jsonb_array_length(new.attachments) > 8 then
    raise exception 'A post can have up to 8 files.' using errcode = 'check_violation';
  end if;
  for f in select * from jsonb_array_elements(new.attachments) loop
    if jsonb_typeof(f) <> 'object'
       or coalesce(f->>'path', '') !~ ('^' || new.class_id::text || '/[0-9a-f-]{36}\.(pdf|doc|docx|ppt|pptx|xls|xlsx|txt|jpg|jpeg|png|mp3|m4a)$')
       or char_length(coalesce(f->>'name', '')) not between 1 and 200 then
      raise exception 'That file cannot be attached to this class.' using errcode = 'check_violation';
    end if;
  end loop;
  return new;
end $$;
revoke all on function private.check_activity_files() from public, anon, authenticated;
create trigger activities_files before insert or update of attachments, class_id on public.activities
  for each row execute function private.check_activity_files();

grant insert (video_url, attachments), update (video_url, attachments) on public.activities to authenticated;

-- Files live in a private bucket, one folder per class: <class id>/<file id>.<type>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('homework', 'homework', false, 26214400,
        array['application/pdf', 'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/vnd.ms-powerpoint',
              'application/vnd.openxmlformats-officedocument.presentationml.presentation',
              'application/vnd.ms-excel',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'text/plain', 'image/jpeg', 'image/png', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a'])
on conflict (id) do nothing;

-- The class a homework file belongs to (null when the path is not a class folder).
create function private.homework_class(path text) returns uuid
language sql immutable set search_path = '' as $$
  select case when path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/' then left(path, 36)::uuid end
$$;
revoke all on function private.homework_class(text) from public, anon;
grant execute on function private.homework_class(text) to authenticated, service_role;

-- The class teacher adds and removes files; the class, its parents and admins can open them.
create policy homework_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'homework' and private.is_class_teacher(private.homework_class(name)));
create policy homework_select on storage.objects for select to authenticated
  using (bucket_id = 'homework' and (private.in_class(private.homework_class(name)) or private.is_admin()));
create policy homework_delete on storage.objects for delete to authenticated
  using (bucket_id = 'homework' and private.is_class_teacher(private.homework_class(name)));

-- ---------------------------------------------------------------
-- Practice games
-- ---------------------------------------------------------------
-- items is a list of questions. Each one is:
--   { "t": "choice", "q": …, "sub": …, "options": […], "answer": 0, "why": … }
--   { "t": "spot",   "q": …, "words": […], "answer": 2, "fix": …, "why": … }   tap the wrong word
--   { "t": "match",  "q": …, "pairs": [[left, right], …], "why": … }
--   { "t": "order",  "q": …, "lines": […in the correct order…], "why": … }
create table public.practice_sets (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  stage      smallint not null default 1 check (stage between 1 and 20),
  sort       integer not null default 0,
  topic      text not null check (char_length(trim(topic)) between 1 and 120),
  topic_ta   text not null default '' check (char_length(topic_ta) <= 120),
  title      text not null check (char_length(trim(title)) between 1 and 120),
  title_ta   text not null default '' check (char_length(title_ta) <= 120),
  intro      text not null default '' check (char_length(intro) <= 600),
  intro_ta   text not null default '' check (char_length(intro_ta) <= 600),
  source     text not null default '' check (char_length(source) <= 120),
  items      jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 40
                                   and char_length(items::text) <= 60000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Admin → teacher: which teachers may use a game.
create table public.practice_shares (
  set_id     uuid not null references public.practice_sets on delete cascade,
  teacher_id uuid not null references public.profiles on delete cascade,
  shared_by  uuid not null default auth.uid() references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (set_id, teacher_id)
);
create index practice_shares_teacher on public.practice_shares(teacher_id);

-- Teacher → class: the game is open for that class's students.
create table public.practice_releases (
  id          uuid primary key default gen_random_uuid(),
  set_id      uuid not null references public.practice_sets on delete cascade,
  class_id    uuid not null references public.classes on delete cascade,
  due_on      date,
  released_by uuid not null default auth.uid() references public.profiles on delete cascade,
  created_at  timestamptz not null default now(),
  unique (set_id, class_id)
);
create index practice_releases_class on public.practice_releases(class_id, created_at desc);

-- One row each time a student finishes a game. Written only by practice_finish().
create table public.practice_attempts (
  id         uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.practice_releases on delete cascade,
  student_id uuid not null references public.profiles on delete cascade,
  score      integer not null check (score >= 0),
  total      integer not null check (total > 0 and score <= total),
  answers    jsonb not null,
  created_at timestamptz not null default now()
);
create index practice_attempts_release on public.practice_attempts(release_id, student_id);
create index practice_attempts_student on public.practice_attempts(student_id, created_at desc);

create function private.practice_shared(sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.practice_shares where set_id = sid and teacher_id = auth.uid())
$$;
-- Released to a class I teach, am in, or my child is in.
create function private.practice_released(sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.practice_releases r where r.set_id = sid and private.in_class(r.class_id))
$$;
create function private.practice_release_class(rid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select class_id from public.practice_releases where id = rid
$$;
revoke all on function private.practice_shared(uuid), private.practice_released(uuid), private.practice_release_class(uuid) from public, anon;
grant execute on function private.practice_shared(uuid), private.practice_released(uuid), private.practice_release_class(uuid)
  to authenticated, service_role;

alter table public.practice_sets     enable row level security;
alter table public.practice_shares   enable row level security;
alter table public.practice_releases enable row level security;
alter table public.practice_attempts enable row level security;

-- Games: admins see all; a teacher sees the ones given to them; a class sees the ones released to it.
create policy practice_sets_select on public.practice_sets for select to authenticated
  using (private.is_admin() or private.practice_shared(id) or private.practice_released(id));

create policy practice_shares_select on public.practice_shares for select to authenticated
  using (private.is_admin() or teacher_id = auth.uid());
create policy practice_shares_insert on public.practice_shares for insert to authenticated
  with check (private.is_admin() and shared_by = auth.uid()
              and exists (select 1 from public.profiles p where p.id = teacher_id and p.role = 'teacher'));
create policy practice_shares_delete on public.practice_shares for delete to authenticated
  using (private.is_admin());

create policy practice_releases_select on public.practice_releases for select to authenticated
  using (private.in_class(class_id) or private.is_admin());
create policy practice_releases_insert on public.practice_releases for insert to authenticated
  with check (private.is_class_teacher(class_id) and released_by = auth.uid()
              and (private.is_admin() or private.practice_shared(set_id)));
create policy practice_releases_update on public.practice_releases for update to authenticated
  using (private.is_class_teacher(class_id)) with check (private.is_class_teacher(class_id));
create policy practice_releases_delete on public.practice_releases for delete to authenticated
  using (private.is_class_teacher(class_id));

-- Scores: the student and their parents, the class teacher, and admins.
create policy practice_attempts_select on public.practice_attempts for select to authenticated
  using (private.is_self_or_parent(student_id)
         or private.is_class_teacher(private.practice_release_class(release_id))
         or private.is_admin());

-- Accounts waiting for approval see nothing (same lock as the other school tables).
do $$ declare tb text; begin
  foreach tb in array array['practice_sets', 'practice_shares', 'practice_releases', 'practice_attempts'] loop
    execute format('create policy %I on public.%I as restrictive for all to authenticated
                    using (private.is_approved()) with check (private.is_approved())', tb || '_approved_only', tb);
  end loop;
end $$;

revoke all on public.practice_sets, public.practice_shares, public.practice_releases, public.practice_attempts
  from anon, authenticated;
grant select on public.practice_sets, public.practice_shares, public.practice_releases, public.practice_attempts
  to authenticated;
grant insert (set_id, teacher_id, shared_by), delete on public.practice_shares to authenticated;
grant insert (id, set_id, class_id, due_on, released_by), update (due_on), delete on public.practice_releases to authenticated;
grant all on public.practice_sets, public.practice_shares, public.practice_releases, public.practice_attempts
  to service_role;

-- Tell the class (and parents) when a game is released.
create function private.on_practice_release() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify_students(private.class_students(new.class_id), 'activity',
    'New practice game: ' || (select title from public.practice_sets where id = new.set_id), '', '#/practice');
  return new;
end $$;
revoke all on function private.on_practice_release() from public, anon, authenticated;
create trigger practice_releases_notify after insert on public.practice_releases
  for each row execute function private.on_practice_release();

-- The student's answers are marked here, so a score cannot be made up.
-- answers has one entry per question: the chosen option (choice, spot), or the
-- student's arrangement as a list of original positions (match, order).
create function private.practice_finish(rid uuid, ans jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r record; it jsonb; a jsonb; i int; k int; m int; score int := 0; total int := 0;
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  select pr.id, pr.class_id, ps.items into r
    from public.practice_releases pr join public.practice_sets ps on ps.id = pr.set_id
   where pr.id = rid;
  if r.id is null or not private.is_class_member(r.class_id) then
    raise exception 'This game is not open for you.';
  end if;
  if jsonb_typeof(ans) is distinct from 'array' or jsonb_array_length(ans) <> jsonb_array_length(r.items)
     or char_length(ans::text) > 20000 then
    raise exception 'These answers do not match the game.';
  end if;
  if (select count(*) from public.practice_attempts where release_id = rid and student_id = auth.uid()) >= 200 then
    raise exception 'You have played this game many times already. Ask your teacher for a new one.';
  end if;
  for i in 0 .. jsonb_array_length(r.items) - 1 loop
    it := r.items -> i; a := ans -> i;
    if it ->> 't' in ('match', 'order') then
      m := jsonb_array_length(coalesce(it -> 'pairs', it -> 'lines'));
      total := total + m;
      if jsonb_typeof(a) = 'array' then
        for k in 0 .. m - 1 loop
          if a -> k = to_jsonb(k) then score := score + 1; end if;
        end loop;
      end if;
    else
      total := total + 1;
      if jsonb_typeof(a) = 'number' and a = it -> 'answer' then score := score + 1; end if;
    end if;
  end loop;
  insert into public.practice_attempts (release_id, student_id, score, total, answers)
  values (rid, auth.uid(), score, total, ans);
  return jsonb_build_object('score', score, 'total', total);
end $$;
revoke all on function private.practice_finish(uuid, jsonb) from public, anon;
grant execute on function private.practice_finish(uuid, jsonb) to authenticated, service_role;

create function public.practice_finish(rid uuid, ans jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
begin perform private.require_approved(); return private.practice_finish(rid, ans); end $$;
revoke all on function public.practice_finish(uuid, jsonb) from public, anon;
grant execute on function public.practice_finish(uuid, jsonb) to authenticated, service_role;

notify pgrst, 'reload schema';
