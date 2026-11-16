-- Practice games: school admins can edit the questions and add their own games
-- from the website (Practice → Game library → Edit / New game).
-- Apply AFTER 20261115000001_practice_workbook.sql.
--
-- A game an admin has changed is kept: running the workbook file again does not
-- overwrite it. New games are hidden like the others until an admin gives them to teachers.

alter table public.practice_sets
  add column edited_at  timestamptz,
  add column edited_by  uuid references public.profiles on delete set null;

-- What is wrong with a list of questions (null when it is fine).
create function private.practice_items_problem(items jsonb) returns text
language plpgsql immutable set search_path = '' as $$
declare it jsonb; i int := 0; n int; x jsonb;
begin
  if jsonb_typeof(items) is distinct from 'array' or jsonb_array_length(items) not between 1 and 40 then
    return 'A game needs 1 to 40 questions.';
  end if;
  for it in select * from jsonb_array_elements(items) loop
    i := i + 1;
    if jsonb_typeof(it) <> 'object' or coalesce(it ->> 't', '') not in ('choice', 'spot', 'match', 'order') then
      return format('Question %s: unknown type.', i);
    end if;
    if jsonb_typeof(it -> 'q') is distinct from 'string' or char_length(trim(it ->> 'q')) not between 1 and 600 then
      return format('Question %s: the question text is missing.', i);
    end if;
    if it ? 'why' and (jsonb_typeof(it -> 'why') <> 'string' or char_length(it ->> 'why') > 600) then
      return format('Question %s: the explanation is too long.', i);
    end if;
    if it ->> 't' in ('choice', 'spot') then
      x := case when it ->> 't' = 'choice' then it -> 'options' else it -> 'words' end;
      n := case when jsonb_typeof(x) = 'array' then jsonb_array_length(x) else 0 end;
      if n < 2 or n > (case when it ->> 't' = 'choice' then 6 else 12 end) then
        return format('Question %s: %s', i, case when it ->> 't' = 'choice' then '2 to 6 options are needed.' else '2 to 12 words are needed.' end);
      end if;
      if jsonb_typeof(it -> 'answer') is distinct from 'number' or (it ->> 'answer') !~ '^[0-9]+$' or (it ->> 'answer')::int >= n then
        return format('Question %s: choose the right answer.', i);
      end if;
    else
      x := case when it ->> 't' = 'match' then it -> 'pairs' else it -> 'lines' end;
      n := case when jsonb_typeof(x) = 'array' then jsonb_array_length(x) else 0 end;
      if n < 2 or n > 8 then
        return format('Question %s: 2 to 8 %s are needed.', i, case when it ->> 't' = 'match' then 'pairs' else 'lines' end);
      end if;
      if it ->> 't' = 'match' and exists (select 1 from jsonb_array_elements(x) p
           where jsonb_typeof(p) <> 'array' or jsonb_array_length(p) <> 2
              or jsonb_typeof(p -> 0) <> 'string' or jsonb_typeof(p -> 1) <> 'string'
              or trim(p ->> 0) = '' or trim(p ->> 1) = '') then
        return format('Question %s: every pair needs both sides.', i);
      end if;
    end if;
    -- Every option, word or line is non-empty text.
    if it ->> 't' <> 'match' and exists (select 1 from jsonb_array_elements(x) e
         where jsonb_typeof(e) <> 'string' or trim(e #>> '{}') = '' or char_length(e #>> '{}') > 600) then
      return format('Question %s: an answer line is empty.', i);
    end if;
  end loop;
  return null;
end $$;
revoke all on function private.practice_items_problem(jsonb) from public, anon;
grant execute on function private.practice_items_problem(jsonb) to authenticated, service_role;

create function private.practice_set_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare problem text;
begin
  -- Loading the workbook file again keeps a game the school has edited.
  if tg_op = 'UPDATE' and auth.uid() is null and old.edited_at is not null
     and new.edited_at is not distinct from old.edited_at then
    return old;
  end if;
  problem := private.practice_items_problem(new.items);
  if problem is not null then raise exception '%', problem using errcode = 'check_violation'; end if;
  new.updated_at := now();
  if auth.uid() is not null then new.edited_at := now(); new.edited_by := auth.uid(); end if;
  return new;
end $$;
revoke all on function private.practice_set_guard() from public, anon, authenticated;
create trigger practice_sets_guard before insert or update on public.practice_sets
  for each row execute function private.practice_set_guard();

create policy practice_sets_insert on public.practice_sets for insert to authenticated
  with check (private.is_admin());
create policy practice_sets_update on public.practice_sets for update to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy practice_sets_delete on public.practice_sets for delete to authenticated
  using (private.is_admin());

grant insert (id, slug, stage, sort, topic, topic_ta, title, title_ta, intro, intro_ta, source, items),
      update (stage, sort, topic, topic_ta, title, title_ta, intro, intro_ta, source, items),
      delete on public.practice_sets to authenticated;

notify pgrst, 'reload schema';
