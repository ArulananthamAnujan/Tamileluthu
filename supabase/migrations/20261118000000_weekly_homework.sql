-- Weekly homework: each homework post can carry a copy-writing task, a reading
-- comprehension task and the student who presents that week.
-- Apply AFTER 20261117000000_documents.sql.

alter table public.activities
  add column copy_work          text not null default '' check (char_length(copy_work) <= 3000),
  add column reading_work       text not null default '' check (char_length(reading_work) <= 3000),
  add column presenter_id       uuid references public.profiles on delete set null,
  add column presenter_name     text,
  add column presentation_topic text not null default '' check (char_length(presentation_topic) <= 300);
create index activities_presenter on public.activities(class_id, on_date desc) where presenter_id is not null;

-- The presenter must be a student in the class. Their name is copied in here,
-- so classmates can see who presents without being able to read other accounts.
create function private.set_presenter() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.presenter_id is null then
    new.presenter_name := null;
  else
    if not private.student_in_class(new.class_id, new.presenter_id) then
      raise exception 'The presenter must be a student in this class.' using errcode = 'check_violation';
    end if;
    new.presenter_name := (select full_name from public.profiles where id = new.presenter_id);
  end if;
  return new;
end $$;
revoke all on function private.set_presenter() from public, anon, authenticated;
create trigger activities_presenter before insert or update on public.activities
  for each row execute function private.set_presenter();

-- Tell the presenter (and their parents) when they are chosen.
create function private.on_presenter() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.presenter_id is not null and (tg_op = 'INSERT' or new.presenter_id is distinct from old.presenter_id) then
    perform private.notify_students(array[new.presenter_id], 'activity',
      'Presentation this week: ' || coalesce(nullif(trim(new.presentation_topic), ''), new.title),
      case when new.due_on is not null then 'Be ready by ' || to_char(new.due_on, 'FMDD Mon') || '.' else '' end, '#/diary');
  end if;
  return new;
end $$;
revoke all on function private.on_presenter() from public, anon, authenticated;
create trigger activities_presenter_notify after insert or update of presenter_id on public.activities
  for each row execute function private.on_presenter();

grant insert (copy_work, reading_work, presenter_id, presentation_topic),
      update (copy_work, reading_work, presenter_id, presentation_topic) on public.activities to authenticated;

notify pgrst, 'reload schema';
