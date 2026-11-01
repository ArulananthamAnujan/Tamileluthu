-- Writing a teacher checks FOR a student (submissions.for_student) is saved
-- under the teacher's id. Let that student and their linked parents read it
-- (and its photos), and tell them when the feedback is ready.

create policy subs_select_for_student on public.submissions for select to authenticated
  using (for_student is not null and private.is_self_or_parent(for_student));

create function private.can_view_writing_photo(path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.submissions s
                 where path = any (s.photo_paths) and s.for_student is not null
                   and private.is_self_or_parent(s.for_student))
$$;
revoke all on function private.can_view_writing_photo(text) from public, anon;
grant execute on function private.can_view_writing_photo(text) to authenticated, service_role;

create policy writing_select_for_student on storage.objects for select to authenticated
  using (bucket_id = 'writing' and private.can_view_writing_photo(name));

create function private.on_teacher_check_done() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.for_student is not null and new.status = 'checked' and old.status is distinct from 'checked' then
    perform private.notify_students(array[new.for_student], 'comment',
      'Writing feedback ready: ' || coalesce(nullif(new.title, ''), 'writing'), '', '#/writing');
  end if;
  return new;
end $$;
revoke all on function private.on_teacher_check_done() from public, anon, authenticated;
create trigger submissions_teacher_check_notify after update of status on public.submissions
  for each row execute function private.on_teacher_check_done();

notify pgrst, 'reload schema';
