-- Writing checks: no limits by default, several checks can run at once.
-- The school admin can still set optional limits (0 = no limit) under
-- Admin → School details, e.g. if a lot of checks are being wasted.
-- Apply AFTER 20261103000000_teacher_checks_invites.sql.

alter table public.school_settings
  add column check_limit_hour int not null default 0 check (check_limit_hour between 0 and 10000),
  add column check_limit_day int not null default 0 check (check_limit_day between 0 and 100000),
  add column check_limit_per_writing int not null default 0 check (check_limit_per_writing between 0 and 100);
grant update (check_limit_hour, check_limit_day, check_limit_per_writing) on public.school_settings to authenticated;

create or replace function private.claim_writing_check(sid uuid, owner uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.submissions; token uuid; lim record;
begin
 -- Serialise claims for the same submission only, so many people (or one
 -- teacher with many pages) can check at the same time.
 perform pg_advisory_xact_lock(hashtextextended(sid::text,0));
 select * into s from public.submissions where id=sid and student_id=owner for update;
 if not found then return jsonb_build_object('status','forbidden'); end if;
 if s.status='checked' then return jsonb_build_object('status','checked'); end if;
 -- The same piece of writing is never checked twice at once (that would only cost twice).
 if s.status='checking' and s.check_started_at>now()-interval '5 minutes' then
  return jsonb_build_object('status','checking'); end if;
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
