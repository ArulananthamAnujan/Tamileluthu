-- Essay question and feedback language. All fixtures are rolled back.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('e0000000-0000-4000-8000-000000000001','essay-s1@example.invalid','{"role":"student","full_name":"S1"}'),
('e0000000-0000-4000-8000-000000000002','essay-s2@example.invalid','{"role":"student","full_name":"S2"}');
update public.profiles set approved = true where not approved; -- existing accounts are approved
set local role authenticated;
select set_config('request.jwt.claim.sub','e0000000-0000-4000-8000-000000000001',true);
do $$ declare sid uuid; begin
  insert into public.submissions(student_id,input_mode,original_text,question,feedback_lang)
  values(auth.uid(),'text','தமிழ்','என் பாடசாலை பற்றி ஒரு கட்டுரை எழுதுக','ta') returning id into sid;
  begin
    insert into public.submissions(student_id,input_mode,original_text,feedback_lang) values(auth.uid(),'text','x','fr');
    raise exception 'Bad feedback language accepted';
  exception when check_violation then null; end;
  begin update public.submissions set essay='{}' where id=sid; raise exception 'Student wrote the assessment';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.submissions set status='checked', essay='{"question_status":"no_question"}' where student_id='e0000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$ declare sid uuid; begin
  select id into sid from public.submissions limit 1;
  perform public.set_question(sid, 'பாடசாலை வாழ்க்கை');
  if (select status from public.submissions where id=sid)<>'pending' then raise exception 'Not reset for re-check'; end if;
  if (select question from public.submissions where id=sid)<>'பாடசாலை வாழ்க்கை' then raise exception 'Question not saved'; end if;
end $$;
select set_config('request.jwt.claim.sub','e0000000-0000-4000-8000-000000000002',true);
do $$ begin
  begin perform public.set_question((select id from public.submissions where student_id='e0000000-0000-4000-8000-000000000001' limit 1), 'x');
    raise exception 'Changed another student''s question';
  exception when raise_exception then if sqlerrm not like 'You can only%' then raise; end if; end;
end $$;
reset role;
select 'PASS: essay question, feedback language, confirm question, ownership; fixtures rolled back' as result;
rollback;
