-- Teachers can check writing themselves (for any student, by name), and
-- higher daily limits for teachers. Apply AFTER 20261102000000_admin_settings_notifications.sql.

alter table public.submissions
  add column checked_for text check (checked_for is null or char_length(checked_for) <= 120),
  add column for_student uuid references public.profiles on delete set null;
grant insert (checked_for, for_student) on public.submissions to authenticated;

-- A teacher's own checks are stored under the teacher's id, so only that
-- teacher can see them (the existing select policy already allows this).
create policy subs_insert_teacher on public.submissions for insert to authenticated
  with check (
    student_id = auth.uid()
    and private.my_role() = 'teacher'
    and (for_student is null or private.is_teacher_of(for_student))
  );
-- Students cannot attach a check to someone else.
alter policy subs_insert on public.submissions
  with check (student_id = auth.uid() and private.my_role() = 'student' and for_student is null);
alter table public.submissions add constraint submissions_for_student_teacher_only
  check (for_student is null or checked_for is not null) not valid;

-- Same claiming rules as before; teachers get higher limits because they
-- check work for a whole class.
create or replace function private.claim_writing_check(sid uuid, owner uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.submissions; token uuid; teacher boolean;
begin
 perform pg_advisory_xact_lock(hashtextextended(owner::text,0));
 select * into s from public.submissions where id=sid and student_id=owner for update;
 if not found then return jsonb_build_object('status','forbidden'); end if;
 if s.status='checked' then return jsonb_build_object('status','checked'); end if;
 if s.status='checking' and s.check_started_at>now()-interval '5 minutes' then
  return jsonb_build_object('status','checking'); end if;
 teacher := exists(select 1 from public.profiles where id=owner and role='teacher');
 if (select count(*) from public.submissions where student_id=owner and status='checking' and check_started_at>now()-interval '5 minutes') >= (case when teacher then 3 else 1 end) then
  return jsonb_build_object('status','busy'); end if;
 if (select count(*) from private.check_attempts where student_id=owner and started_at>now()-interval '1 hour')>=(case when teacher then 40 else 10 end)
 or (select count(*) from private.check_attempts where student_id=owner and started_at>now()-interval '1 day')>=(case when teacher then 150 else 40 end)
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

notify pgrst, 'reload schema';
