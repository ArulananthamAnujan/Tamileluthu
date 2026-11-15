-- Transactional tests for homework files, YouTube links and practice games.
-- Run after all migrations. All fixtures are rolled back.
begin;
insert into public.teacher_emails(email, is_admin) values
  ('pg-admin@example.invalid', true), ('pg-t1@example.invalid', false), ('pg-t2@example.invalid', false);
insert into auth.users(id,email,raw_user_meta_data) values
('b0000000-0000-4000-8000-000000000001','pg-admin@example.invalid','{"role":"teacher","full_name":"Admin"}'),
('b0000000-0000-4000-8000-000000000002','pg-t1@example.invalid','{"role":"teacher","full_name":"T One"}'),
('b0000000-0000-4000-8000-000000000003','pg-t2@example.invalid','{"role":"teacher","full_name":"T Two"}'),
('b0000000-0000-4000-8000-000000000004','pg-s1@example.invalid','{"role":"student","full_name":"S One"}'),
('b0000000-0000-4000-8000-000000000005','pg-s2@example.invalid','{"role":"student","full_name":"S Two"}'),
('b0000000-0000-4000-8000-000000000006','pg-p1@example.invalid','{"role":"parent","full_name":"P One"}'),
('b0000000-0000-4000-8000-000000000007','pg-s3@example.invalid','{"role":"student","full_name":"S Waiting"}');
update public.profiles set approved = true where not approved and id <> 'b0000000-0000-4000-8000-000000000007';
insert into public.classes(id,name,teacher_id) values
('b1000000-0000-4000-8000-00000000000a','Class A','b0000000-0000-4000-8000-000000000002'),
('b1000000-0000-4000-8000-00000000000b','Class B','b0000000-0000-4000-8000-000000000003'),
('b1000000-0000-4000-8000-00000000000c','Admin class','b0000000-0000-4000-8000-000000000001');
insert into public.class_members(class_id,student_id) values
('b1000000-0000-4000-8000-00000000000a','b0000000-0000-4000-8000-000000000004'),
('b1000000-0000-4000-8000-00000000000a','b0000000-0000-4000-8000-000000000007'),
('b1000000-0000-4000-8000-00000000000b','b0000000-0000-4000-8000-000000000005'),
('b1000000-0000-4000-8000-00000000000c','b0000000-0000-4000-8000-000000000004');
insert into public.parent_links(parent_id,student_id) values('b0000000-0000-4000-8000-000000000006','b0000000-0000-4000-8000-000000000004');
do $$ begin
  if (select count(*) from public.practice_sets) < 18 then raise exception 'Workbook games are not loaded'; end if;
end $$;
create temp table ids on commit drop as
  select (select id from public.practice_sets where slug = 'verb-endings-1') as x,
         (select id from public.practice_sets where slug = 'register') as y;
grant select on ids to authenticated;

set local role authenticated;

-- 1. Hidden by default: a teacher sees no games and cannot release one.
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000002',true);
do $$ begin
  if (select count(*) from public.practice_sets) <> 0 then raise exception 'Teacher sees games that were not given to them'; end if;
  begin
    insert into public.practice_releases(set_id, class_id) select x, 'b1000000-0000-4000-8000-00000000000a' from ids;
    raise exception 'Teacher released a game that was not given to them';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.practice_shares(set_id, teacher_id) select x, auth.uid() from ids;
    raise exception 'Teacher gave a game to themself';
  exception when insufficient_privilege then null; end;
end $$;
-- Students and parents see nothing either.
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000004',true);
do $$ begin
  if (select count(*) from public.practice_sets) <> 0 then raise exception 'Student sees unreleased games'; end if;
end $$;

-- 2. The admin sees every game and gives one to teacher 1 (teachers only).
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000001',true);
do $$ begin
  if (select count(*) from public.practice_sets) < 18 then raise exception 'Admin cannot see the games'; end if;
  insert into public.practice_shares(set_id, teacher_id) select x, 'b0000000-0000-4000-8000-000000000002' from ids;
  begin
    insert into public.practice_shares(set_id, teacher_id) select x, 'b0000000-0000-4000-8000-000000000004' from ids;
    raise exception 'A game was given to a student';
  exception when insufficient_privilege then null; end;
  begin
    update public.practice_sets set title = 'Changed';
    raise exception 'Games could be edited from the website';
  exception when insufficient_privilege then null; end;
end $$;

-- 3. Teacher 1 sees only that game and releases it to their own class only.
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000002',true);
do $$ begin
  if (select count(*) from public.practice_sets) <> 1 then raise exception 'Teacher should see exactly the one game given'; end if;
  begin
    insert into public.practice_releases(set_id, class_id) select x, 'b1000000-0000-4000-8000-00000000000b' from ids;
    raise exception 'Teacher released to another teacher''s class';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.practice_releases(set_id, class_id) select y, 'b1000000-0000-4000-8000-00000000000a' from ids;
    raise exception 'Teacher released a game that was not given';
  exception when insufficient_privilege then null; end;
  insert into public.practice_releases(id, set_id, class_id, due_on)
    select 'b2000000-0000-4000-8000-000000000001', x, 'b1000000-0000-4000-8000-00000000000a', '2026-12-01' from ids;
end $$;
-- Teacher 2 was given nothing.
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000003',true);
do $$ begin
  if (select count(*) from public.practice_sets) <> 0 or (select count(*) from public.practice_releases) <> 0
     or (select count(*) from public.practice_shares) <> 0 then raise exception 'Other teacher sees the game'; end if;
end $$;

-- 4. Only the class it was released to can see and play it.
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000005',true);
do $$ begin
  if (select count(*) from public.practice_sets) <> 0 or (select count(*) from public.practice_releases) <> 0 then
    raise exception 'Student in another class sees the game'; end if;
  begin
    perform public.practice_finish('b2000000-0000-4000-8000-000000000001', '[0,0,0,0,0,0,0]');
    raise exception 'Student in another class played the game';
  exception when raise_exception then if sqlerrm not like '%not open for you%' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000004',true);
do $$ declare r jsonb; perfect jsonb; n int; begin
  if (select count(*) from public.practice_sets) <> 1 or (select count(*) from public.practice_releases) <> 1 then
    raise exception 'Student cannot see the released game'; end if;
  if (select count(*) from public.notifications where link = '#/practice') <> 1 then raise exception 'Student was not told about the game'; end if;
  select jsonb_agg(it -> 'answer' order by ord), count(*) into perfect, n
    from public.practice_sets s, jsonb_array_elements(s.items) with ordinality e(it, ord) where s.slug = 'verb-endings-1';
  r := public.practice_finish('b2000000-0000-4000-8000-000000000001', perfect);
  if (r ->> 'score')::int <> n or (r ->> 'total')::int <> n then raise exception 'Perfect answers not marked full: %', r; end if;
  -- One wrong answer loses exactly one mark.
  r := public.practice_finish('b2000000-0000-4000-8000-000000000001',
        jsonb_set(perfect, '{0}', to_jsonb(((perfect ->> 0)::int + 1) % 4)));
  if (r ->> 'score')::int <> n - 1 then raise exception 'Wrong answer not marked: %', r; end if;
  r := public.practice_finish('b2000000-0000-4000-8000-000000000001', (select jsonb_agg(null::int) from generate_series(1, n)));
  if (r ->> 'score')::int <> 0 then raise exception 'Empty answers scored: %', r; end if;
  begin
    perform public.practice_finish('b2000000-0000-4000-8000-000000000001', '[1,2]');
    raise exception 'Answers of the wrong length accepted';
  exception when raise_exception then if sqlerrm not like '%do not match%' then raise; end if; end;
  begin
    insert into public.practice_attempts(release_id, student_id, score, total, answers)
    values('b2000000-0000-4000-8000-000000000001', auth.uid(), 7, 7, '[]');
    raise exception 'Student wrote their own score';
  exception when insufficient_privilege then null; end;
  if (select count(*) from public.practice_attempts) <> 3 then raise exception 'Student cannot see own scores'; end if;
end $$;
-- The parent sees the game, the child's scores and a notification.
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000006',true);
do $$ begin
  if (select count(*) from public.practice_releases) <> 1 or (select count(*) from public.practice_attempts) <> 3
     or (select count(*) from public.practice_sets) <> 1 then raise exception 'Parent cannot see the child''s practice'; end if;
  if (select count(*) from public.notifications where link = '#/practice') <> 1 then raise exception 'Parent was not told'; end if;
  begin
    perform public.practice_finish('b2000000-0000-4000-8000-000000000001', '[0,0,0,0,0,0,0]');
    raise exception 'Parent played the game';
  exception when raise_exception then if sqlerrm not like '%not open for you%' then raise; end if; end;
end $$;
-- The class teacher sees the scores; the other teacher and the other student do not.
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000002',true);
do $$ begin
  if (select count(*) from public.practice_attempts) <> 3 then raise exception 'Class teacher cannot see scores'; end if;
  if (select max(score) from public.practice_attempts) <> 7 then raise exception 'Best score wrong'; end if;
end $$;
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000003',true);
do $$ begin if (select count(*) from public.practice_attempts) <> 0 then raise exception 'Other teacher sees scores'; end if; end $$;
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000005',true);
do $$ begin if (select count(*) from public.practice_attempts) <> 0 then raise exception 'Other student sees scores'; end if; end $$;
-- An account waiting for approval sees nothing, even in the class.
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000007',true);
do $$ begin
  if (select count(*) from public.practice_releases) <> 0 or (select count(*) from public.practice_sets) <> 0 then
    raise exception 'Waiting account sees practice games'; end if;
  begin
    perform public.practice_finish('b2000000-0000-4000-8000-000000000001', '[0,0,0,0,0,0,0]');
    raise exception 'Waiting account played';
  exception when raise_exception then null; end;
end $$;

-- 5. Every workbook game can be released by an admin and is marked full for the right answers
--    (this also proves the answer keys and the marking agree for all four question types).
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000001',true);
insert into public.practice_releases(set_id, class_id) select id, 'b1000000-0000-4000-8000-00000000000c' from public.practice_sets;
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000004',true);
do $$ declare g record; perfect jsonb; r jsonb; seen int := 0; begin
  for g in select pr.id as rid, s.slug, s.items from public.practice_releases pr join public.practice_sets s on s.id = pr.set_id
            where pr.class_id = 'b1000000-0000-4000-8000-00000000000c' loop
    select jsonb_agg(case when it ->> 't' in ('match', 'order')
                          then (select jsonb_agg(k) from generate_series(0, jsonb_array_length(coalesce(it -> 'pairs', it -> 'lines')) - 1) k)
                          else it -> 'answer' end order by ord)
      into perfect from jsonb_array_elements(g.items) with ordinality e(it, ord);
    r := public.practice_finish(g.rid, perfect);
    if (r ->> 'score') <> (r ->> 'total') or (r ->> 'total')::int < jsonb_array_length(g.items) then
      raise exception 'Game % not marked full for the right answers: %', g.slug, r; end if;
    seen := seen + 1;
  end loop;
  if seen < 18 then raise exception 'Student sees only % admin-released games', seen; end if;
end $$;

-- 6. Taking a game back from a teacher keeps what is already released; removing the release removes the scores.
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000001',true);
delete from public.practice_shares where teacher_id = 'b0000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000002',true);
do $$ begin
  if (select count(*) from public.practice_shares) <> 0 then raise exception 'Share not removed'; end if;
  if (select count(*) from public.practice_releases) <> 1 then raise exception 'Released game disappeared'; end if;
  update public.practice_releases set due_on = '2026-12-08' where id = 'b2000000-0000-4000-8000-000000000001';
  delete from public.practice_releases where id = 'b2000000-0000-4000-8000-000000000001';
  if (select count(*) from public.practice_attempts) <> 0 then raise exception 'Scores left behind'; end if;
  begin
    insert into public.practice_releases(set_id, class_id) select x, 'b1000000-0000-4000-8000-00000000000a' from ids;
    raise exception 'Teacher released again after the game was taken back';
  exception when insufficient_privilege then null; end;
end $$;

-- 7. Diary posts: files must be in the class folder, and the video must be a YouTube link.
do $$ begin
  insert into public.activities(id, class_id, kind, title, video_url, attachments) values
   ('b3000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-00000000000a','homework','Watch and read',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    '[{"path":"b1000000-0000-4000-8000-00000000000a/b4000000-0000-4000-8000-000000000001.pdf","name":"Week 4.pdf","size":1200}]');
  begin
    update public.activities set attachments = '[{"path":"b1000000-0000-4000-8000-00000000000b/b4000000-0000-4000-8000-000000000001.pdf","name":"x.pdf"}]'
     where id = 'b3000000-0000-4000-8000-000000000001';
    raise exception 'File from another class accepted';
  exception when check_violation then null; end;
  begin
    update public.activities set attachments = '[{"path":"b1000000-0000-4000-8000-00000000000a/b4000000-0000-4000-8000-000000000001.exe","name":"x.exe"}]'
     where id = 'b3000000-0000-4000-8000-000000000001';
    raise exception 'Program file accepted';
  exception when check_violation then null; end;
  begin
    update public.activities set attachments = (select jsonb_agg(jsonb_build_object('path',
      'b1000000-0000-4000-8000-00000000000a/b4000000-0000-4000-8000-00000000000' || g || '.pdf', 'name', 'f.pdf')) from generate_series(1, 9) g)
     where id = 'b3000000-0000-4000-8000-000000000001';
    raise exception 'Nine files accepted';
  exception when check_violation then null; end;
  begin
    update public.activities set video_url = 'https://example.org/video' where id = 'b3000000-0000-4000-8000-000000000001';
    raise exception 'Non-YouTube video accepted';
  exception when check_violation then null; end;
  update public.activities set video_url = 'https://youtu.be/dQw4w9WgXcQ', attachments = '[]' where id = 'b3000000-0000-4000-8000-000000000001';
  -- Storage: the class teacher adds files to the class folder only.
  insert into storage.objects(bucket_id, name) values('homework', 'b1000000-0000-4000-8000-00000000000a/b4000000-0000-4000-8000-000000000001.pdf');
  begin
    insert into storage.objects(bucket_id, name) values('homework', 'b1000000-0000-4000-8000-00000000000b/b4000000-0000-4000-8000-000000000002.pdf');
    raise exception 'Teacher uploaded into another class';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects(bucket_id, name) values('homework', 'loose-file.pdf');
    raise exception 'File outside a class folder accepted';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000004',true);
do $$ begin
  if (select count(*) from storage.objects where bucket_id = 'homework') <> 1 then raise exception 'Student cannot open the class file'; end if;
  if (select video_url from public.activities where id = 'b3000000-0000-4000-8000-000000000001') is null then raise exception 'Student cannot see the video'; end if;
  begin
    insert into storage.objects(bucket_id, name) values('homework', 'b1000000-0000-4000-8000-00000000000a/b4000000-0000-4000-8000-000000000003.pdf');
    raise exception 'Student uploaded a homework file';
  exception when insufficient_privilege then null; end;
  delete from storage.objects where bucket_id = 'homework';
  if (select count(*) from storage.objects where bucket_id = 'homework') <> 1 then raise exception 'Student deleted a class file'; end if;
end $$;
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000006',true);
do $$ begin if (select count(*) from storage.objects where bucket_id = 'homework') <> 1 then raise exception 'Parent cannot open the class file'; end if; end $$;
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000005',true);
do $$ begin if (select count(*) from storage.objects where bucket_id = 'homework') <> 0 then raise exception 'Another class can open the file'; end if; end $$;
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000007',true);
do $$ begin if (select count(*) from storage.objects where bucket_id = 'homework') <> 0 then raise exception 'Waiting account can open the file'; end if; end $$;

reset role;
rollback;
