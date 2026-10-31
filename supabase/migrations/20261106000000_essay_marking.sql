-- Examiner-style essay marking: the question, feedback language, and the
-- full assessment (question check, introduction/body/conclusion, rubric).
-- Apply AFTER 20261105000000_subscriptions.sql.

alter table public.submissions
  add column question text check (question is null or char_length(question) <= 2000),
  add column feedback_lang text not null default 'en' check (feedback_lang in ('en','ta')),
  add column essay jsonb;
grant insert (question, feedback_lang) on public.submissions to authenticated;

-- Which written-Tamil standard the examiner marks against.
alter table public.school_settings
  add column tamil_standard text not null default 'sri_lankan' check (tamil_standard in ('sri_lankan','indian','international'));
grant update (tamil_standard) on public.school_settings to authenticated;

-- The writer confirms or corrects the essay question, then checks again.
create function private.set_question(sub uuid, q text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if char_length(coalesce(q, '')) > 2000 then raise exception 'The question is too long.'; end if;
  update public.submissions
     set question = nullif(trim(q), ''), status = 'pending', error = null, check_token = null
   where id = sub and student_id = auth.uid() and status in ('checked', 'error', 'pending');
  if not found then raise exception 'You can only change the question of your own finished writing.'; end if;
end $$;
revoke all on function private.set_question(uuid, text) from public, anon, authenticated;
grant execute on function private.set_question(uuid, text) to authenticated, service_role;
create function public.set_question(sub uuid, q text) returns void language sql security invoker set search_path = ''
  as $$ select private.set_question(sub, q) $$;
revoke all on function public.set_question(uuid, text) from public, anon;
grant execute on function public.set_question(uuid, text) to authenticated, service_role;

notify pgrst, 'reload schema';
