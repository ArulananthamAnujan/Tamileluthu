-- Isolate privileged implementations; keep compatible invoker RPCs.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;
alter function public.my_role() set schema private;
revoke all on function private.my_role() from public, anon, authenticated;
grant execute on function private.my_role() to authenticated, service_role;
create function public.my_role() returns text language sql security invoker set search_path = '' as $$ select private.my_role() $$;
revoke all on function public.my_role() from public, anon;
grant execute on function public.my_role() to authenticated, service_role;
alter function public.is_teacher_of(uuid) set schema private;
revoke all on function private.is_teacher_of(uuid) from public, anon, authenticated;
grant execute on function private.is_teacher_of(uuid) to authenticated, service_role;
create function public.is_teacher_of(sid uuid) returns boolean language sql security invoker set search_path = '' as $$ select private.is_teacher_of(sid) $$;
revoke all on function public.is_teacher_of(uuid) from public, anon;
grant execute on function public.is_teacher_of(uuid) to authenticated, service_role;
alter function public.is_parent_of(uuid) set schema private;
revoke all on function private.is_parent_of(uuid) from public, anon, authenticated;
grant execute on function private.is_parent_of(uuid) to authenticated, service_role;
create function public.is_parent_of(sid uuid) returns boolean language sql security invoker set search_path = '' as $$ select private.is_parent_of(sid) $$;
revoke all on function public.is_parent_of(uuid) from public, anon;
grant execute on function public.is_parent_of(uuid) to authenticated, service_role;
alter function public.can_view_student(uuid) set schema private;
revoke all on function private.can_view_student(uuid) from public, anon, authenticated;
grant execute on function private.can_view_student(uuid) to authenticated, service_role;
create function public.can_view_student(sid uuid) returns boolean language sql security invoker set search_path = '' as $$ select private.can_view_student(sid) $$;
revoke all on function public.can_view_student(uuid) from public, anon;
grant execute on function public.can_view_student(uuid) to authenticated, service_role;
alter function public.is_class_member(uuid) set schema private;
revoke all on function private.is_class_member(uuid) from public, anon, authenticated;
grant execute on function private.is_class_member(uuid) to authenticated, service_role;
create function public.is_class_member(cid uuid) returns boolean language sql security invoker set search_path = '' as $$ select private.is_class_member(cid) $$;
revoke all on function public.is_class_member(uuid) from public, anon;
grant execute on function public.is_class_member(uuid) to authenticated, service_role;
alter function public.is_class_teacher(uuid) set schema private;
revoke all on function private.is_class_teacher(uuid) from public, anon, authenticated;
grant execute on function private.is_class_teacher(uuid) to authenticated, service_role;
create function public.is_class_teacher(cid uuid) returns boolean language sql security invoker set search_path = '' as $$ select private.is_class_teacher(cid) $$;
revoke all on function public.is_class_teacher(uuid) from public, anon;
grant execute on function public.is_class_teacher(uuid) to authenticated, service_role;
alter function public.teaches_me(uuid) set schema private;
revoke all on function private.teaches_me(uuid) from public, anon, authenticated;
grant execute on function private.teaches_me(uuid) to authenticated, service_role;
create function public.teaches_me(tid uuid) returns boolean language sql security invoker set search_path = '' as $$ select private.teaches_me(tid) $$;
revoke all on function public.teaches_me(uuid) from public, anon;
grant execute on function public.teaches_me(uuid) to authenticated, service_role;
alter function public.is_my_parent(uuid) set schema private;
revoke all on function private.is_my_parent(uuid) from public, anon, authenticated;
grant execute on function private.is_my_parent(uuid) to authenticated, service_role;
create function public.is_my_parent(pid uuid) returns boolean language sql security invoker set search_path = '' as $$ select private.is_my_parent(pid) $$;
revoke all on function public.is_my_parent(uuid) from public, anon;
grant execute on function public.is_my_parent(uuid) to authenticated, service_role;
alter function public.join_class(text) set schema private;
revoke all on function private.join_class(text) from public, anon, authenticated;
grant execute on function private.join_class(text) to authenticated, service_role;
create function public.join_class(code text) returns text language sql security invoker set search_path = '' as $$ select private.join_class(code) $$;
revoke all on function public.join_class(text) from public, anon;
grant execute on function public.join_class(text) to authenticated, service_role;
alter function public.link_child(text) set schema private;
revoke all on function private.link_child(text) from public, anon, authenticated;
grant execute on function private.link_child(text) to authenticated, service_role;
create function public.link_child(code text) returns text language sql security invoker set search_path = '' as $$ select private.link_child(code) $$;
revoke all on function public.link_child(text) from public, anon;
grant execute on function public.link_child(text) to authenticated, service_role;
alter function public.new_parent_code() set schema private;
revoke all on function private.new_parent_code() from public, anon, authenticated;
grant execute on function private.new_parent_code() to authenticated, service_role;
create function public.new_parent_code() returns text language sql security invoker set search_path = '' as $$ select private.new_parent_code() $$;
revoke all on function public.new_parent_code() from public, anon;
grant execute on function public.new_parent_code() to authenticated, service_role;
alter function public.set_teacher_comment(uuid, text) set schema private;
revoke all on function private.set_teacher_comment(uuid, text) from public, anon, authenticated;
grant execute on function private.set_teacher_comment(uuid, text) to authenticated, service_role;
create function public.set_teacher_comment(sub uuid, comment text) returns void language sql security invoker set search_path = '' as $$ select private.set_teacher_comment(sub, comment) $$;
revoke all on function public.set_teacher_comment(uuid, text) from public, anon;
grant execute on function public.set_teacher_comment(uuid, text) to authenticated, service_role;
alter function public.handle_new_user() set schema private;
revoke all on function private.handle_new_user() from public, anon, authenticated;
alter function public.is_teacher_email(text) set schema private;
revoke all on function private.is_teacher_email(text) from public, anon, authenticated;
-- Trigger function uses its own private teacher allow-list lookup.
revoke all on function public.gen_code(integer) from public, anon;
grant execute on function public.gen_code(integer) to authenticated, service_role;
revoke all on public.teacher_emails from anon, authenticated;
revoke all on public.profiles, public.classes, public.class_members, public.parent_links, public.submissions from anon, authenticated;
grant select on public.profiles, public.classes, public.class_members, public.parent_links, public.submissions to authenticated;
grant update(full_name) on public.profiles to authenticated;
grant insert(name,teacher_id), update(name), delete on public.classes to authenticated;
grant delete on public.class_members, public.parent_links, public.submissions to authenticated;
grant insert(student_id,title,text_type,input_mode,photo_paths,original_text) on public.submissions to authenticated;
grant all on all tables in schema public to service_role;
do $$ declare p record; begin
  for p in select tablename,policyname from pg_policies where schemaname='public' loop
    execute format('alter policy %I on public.%I to authenticated',p.policyname,p.tablename);
  end loop;
end $$;
alter policy profiles_update on public.profiles with check (id=auth.uid());
alter policy classes_update on public.classes with check (teacher_id=auth.uid());

-- Validate ownership even when clients bypass the form.
create function private.valid_photo_paths(paths text[], owner uuid) returns boolean
language sql immutable security invoker set search_path='' as $$
 select paths is not null and cardinality(paths)<=10
 and cardinality(paths)=(select count(distinct p) from unnest(paths) p)
 and not exists(select 1 from unnest(paths) p where p is null or
 p !~ ('^'||owner::text||'/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/page-[0-9]{2}\.jpg$'))
$$;
revoke all on function private.valid_photo_paths(text[],uuid) from public, anon;
grant execute on function private.valid_photo_paths(text[],uuid) to authenticated,service_role;
alter table public.submissions add constraint submission_input_limits check (
 char_length(title)<=200 and char_length(text_type)<=80
 and coalesce(char_length(original_text),0)<=20000
 and private.valid_photo_paths(photo_paths,student_id)
 and ((input_mode='photo' and cardinality(photo_paths) between 1 and 10)
 or (input_mode='text' and cardinality(photo_paths)=0 and char_length(trim(original_text))>0 and original_text is not null))
) not valid;

alter table public.submissions add column check_token uuid,
 add column check_started_at timestamptz;
create table private.check_attempts (
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references public.profiles(id) on delete cascade,
 submission_id uuid not null, -- retain usage even if the submission is deleted
 started_at timestamptz not null default now()
);
alter table private.check_attempts enable row level security;
revoke all on private.check_attempts from public,anon,authenticated;
grant all on private.check_attempts to service_role;
create index check_attempts_student_time on private.check_attempts(student_id,started_at);
create index check_attempts_submission on private.check_attempts(submission_id);

-- Only the authenticated edge worker (service_role) can claim work.
-- Lock per student before inspecting limits: simultaneous requests cannot race.
create function private.claim_writing_check(sid uuid, owner uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.submissions; token uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(owner::text,0));
 select * into s from public.submissions where id=sid and student_id=owner for update;
 if not found then return jsonb_build_object('status','forbidden'); end if;
 if s.status='checked' then return jsonb_build_object('status','checked'); end if;
 if s.status='checking' and s.check_started_at>now()-interval '5 minutes' then
  return jsonb_build_object('status','checking'); end if;
 if exists(select 1 from public.submissions where student_id=owner and status='checking' and check_started_at>now()-interval '5 minutes') then
  return jsonb_build_object('status','busy'); end if;
 if (select count(*) from private.check_attempts where student_id=owner and started_at>now()-interval '1 hour')>=10
 or (select count(*) from private.check_attempts where student_id=owner and started_at>now()-interval '1 day')>=40
 or (select count(*) from private.check_attempts where submission_id=sid)>=3 then
  return jsonb_build_object('status','limited'); end if;
 update public.submissions set status='error',error='The check timed out. Please retry.',check_token=null
 where student_id=owner and status='checking' and (check_started_at is null or check_started_at<=now()-interval '5 minutes');
 insert into private.check_attempts(student_id,submission_id) values(owner,sid) returning id into token;
 update public.submissions set status='checking',error=null,check_started_at=now(),check_token=token where id=sid;
 return jsonb_build_object('status','claimed','token',token);
end $$;
revoke all on function private.claim_writing_check(uuid,uuid) from public,anon,authenticated;
grant execute on function private.claim_writing_check(uuid,uuid) to service_role;
create function public.claim_writing_check(sid uuid,owner uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.claim_writing_check(sid,owner) $$;
revoke all on function public.claim_writing_check(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_writing_check(uuid,uuid) to service_role;
notify pgrst,'reload schema';
