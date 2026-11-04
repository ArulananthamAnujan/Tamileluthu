-- End-to-end flows, written exactly as the app sends them (same columns,
-- PostgREST-style upserts). Every role, every save. All fixtures roll back.
begin;
insert into public.teacher_emails(email, is_admin) values('fl-admin@example.invalid', true),('fl-t@example.invalid', false);
-- Sign-ups (profiles are created by the auth trigger)
insert into auth.users(id,email,raw_user_meta_data) values
('f0000000-0000-4000-8000-00000000000a','fl-admin@example.invalid','{"role":"teacher","full_name":"Principal"}'),
('f0000000-0000-4000-8000-000000000001','fl-t@example.invalid','{"role":"teacher","full_name":"Teacher"}'),
('f0000000-0000-4000-8000-000000000002','fl-s@example.invalid','{"role":"student","full_name":"Kavin"}'),
('f0000000-0000-4000-8000-000000000003','fl-p@example.invalid','{"role":"parent","full_name":"Parent"}');
update public.profiles set approved = true where not approved; -- existing accounts are approved
set local role authenticated;

-- TEACHER: profile, class, diary, listening, assessment, marks, attendance, report
select set_config('request.jwt.claim.sub','f0000000-0000-4000-8000-000000000001',true);
do $$ declare cid uuid; begin
  update public.profiles set full_name='Teacher T', phone='0400123456', lang='ta' where id=auth.uid();
  insert into public.classes(name,teacher_id) values('Year 5',auth.uid()) returning id into cid;
  update public.classes set name='Year 5 Tamil' where id=cid;
  perform set_config('fl.cid', cid::text, true);
  perform set_config('fl.code', (select join_code from public.classes where id=cid), true);
end $$;

-- STUDENT: joins with the code, sees the class + teacher, makes parent code
select set_config('request.jwt.claim.sub','f0000000-0000-4000-8000-000000000002',true);
do $$ declare pc text; begin
  perform public.join_class(current_setting('fl.code'));
  if (select count(*) from public.class_members m join public.classes c on c.id=m.class_id
        join public.profiles t on t.id=c.teacher_id where m.student_id=auth.uid())<>1 then
    raise exception 'Student cannot load own class + teacher after joining'; end if;
  pc := public.new_parent_code();
  perform set_config('fl.pc', pc, true);
  update public.profiles set full_name='Kavin K', lang='en' where id=auth.uid();
end $$;

-- PARENT: links child, sees child + class + teacher
select set_config('request.jwt.claim.sub','f0000000-0000-4000-8000-000000000003',true);
do $$ begin
  perform public.link_child(current_setting('fl.pc'));
  if (select count(*) from public.parent_links pl join public.profiles s on s.id=pl.student_id where pl.parent_id=auth.uid())<>1 then raise exception 'Parent cannot see child'; end if;
  if (select count(*) from public.class_members m join public.classes c on c.id=m.class_id join public.profiles t on t.id=c.teacher_id
        where m.student_id='f0000000-0000-4000-8000-000000000002')<>1 then raise exception 'Parent cannot see child class + teacher'; end if;
  update public.profiles set full_name='Parent P', phone='+61400123456', lang='ta' where id=auth.uid();
end $$;

-- TEACHER does the day's work
select set_config('request.jwt.claim.sub','f0000000-0000-4000-8000-000000000001',true);
do $$ declare cid uuid := current_setting('fl.cid')::uuid; sid uuid := 'f0000000-0000-4000-8000-000000000002'; aid uuid; rid uuid; asid uuid; repid uuid; begin
  -- roster
  if (select count(*) from public.class_members m join public.profiles p on p.id=m.student_id where m.class_id=cid)<>1 then raise exception 'Teacher roster empty'; end if;
  -- diary
  insert into public.activities(kind,title,body,link_url,on_date,due_on,class_id,created_by)
    values('homework','Read page 4','Read aloud',null,current_date,current_date+1,cid,auth.uid()) returning id into aid;
  update public.activities set kind='homework',title='Read page 5',body='',link_url='https://example.org',on_date=current_date,due_on=null where id=aid;
  perform set_config('fl.aid', aid::text, true);
  -- listening resource + assessment from it
  insert into public.resources(kind,title,description,url,answers_url,show_answers,due_on,class_id,created_by)
    values('listening','Listening 1','','https://example.org/l1',null,false,null,cid,auth.uid()) returning id into rid;
  update public.resources set show_answers=true where id=rid;
  insert into public.assessments(class_id,title,kind,max_mark,held_on,resource_id,created_by)
    values(cid,'Listening 1','listening',20,current_date,rid,auth.uid()) returning id into asid;
  -- marks upsert twice, then publish
  for i in 1..2 loop
    insert into public.marks(assessment_id,student_id,mark,absent,comment) values(asid,sid,15+i,false,'Good')
      on conflict(assessment_id,student_id) do update set assessment_id=excluded.assessment_id, student_id=excluded.student_id,
        mark=excluded.mark, absent=excluded.absent, comment=excluded.comment;
  end loop;
  update public.assessments set published=true where id=asid;
  -- attendance: mark, change, note, clear, mark again
  for st in 1..2 loop
    insert into public.attendance(class_id,student_id,on_date,status,note,marked_by)
      values(cid,sid,current_date,case st when 1 then 'present' else 'late' end,null,auth.uid())
      on conflict(class_id,student_id,on_date) do update set class_id=excluded.class_id, student_id=excluded.student_id,
        on_date=excluded.on_date, status=excluded.status, note=excluded.note, marked_by=excluded.marked_by;
  end loop;
  update public.attendance set note='Bus late' where class_id=cid and student_id=sid and on_date=current_date;
  insert into public.attendance(class_id,student_id,on_date,status,note,marked_by) values(cid,sid,current_date-1,'absent',null,auth.uid());
  delete from public.attendance where class_id=cid and student_id=sid and on_date=current_date-1;
  -- term report: draft, edit
  insert into public.reports(term,period_start,period_end,skills,effort,behaviour,strengths,next_steps,comment,class_id,student_id,created_by)
    values('Term 4',current_date-60,current_date,'{"reading":3}','good','good','Reads well',null,null,cid,sid,auth.uid()) returning id into repid;
  update public.reports set term='Term 4 2026',period_start=null,period_end=null,skills='{"reading":4}',effort=null,behaviour=null,
    strengths='Reads very well',next_steps='Spelling',comment='Great term',updated_at=now() where id=repid;
  perform set_config('fl.repid', repid::text, true);
  -- teacher's own writing check for the student
  insert into public.submissions(student_id,title,checked_for,for_student,text_type,input_mode,photo_paths,original_text,question,feedback_lang)
    values(auth.uid(),'','Kavin K',sid,'essay','text','{}','தமிழ் கட்டுரை',null,'ta');
end $$;
-- Report is published by the server function (service role) when sent
reset role;
update public.reports set published=true, published_at=now() where id=current_setting('fl.repid')::uuid;
update public.submissions set status='checked' where checked_for='Kavin K';
set local role authenticated;

-- STUDENT sees everything and ticks homework done, submits own writing
select set_config('request.jwt.claim.sub','f0000000-0000-4000-8000-000000000002',true);
do $$ declare aid uuid := current_setting('fl.aid')::uuid; begin
  if (select count(*) from public.activities)<>1 then raise exception 'Student cannot see diary'; end if;
  insert into public.activity_done(activity_id,student_id) values(aid,auth.uid());
  delete from public.activity_done where activity_id=aid and student_id=auth.uid();
  insert into public.activity_done(activity_id,student_id) values(aid,auth.uid());
  if (select count(*) from public.attendance)<>1 then raise exception 'Student cannot see attendance'; end if;
  if (select count(*) from public.resources)<>1 then raise exception 'Student cannot see listening'; end if;
  if (select count(*) from public.marks m join public.assessments a on a.id=m.assessment_id)<>1 then raise exception 'Student cannot see marks'; end if;
  if (select count(*) from public.reports r join public.classes c on c.id=r.class_id join public.profiles t on t.id=c.teacher_id)<>1 then raise exception 'Student cannot see report'; end if;
  if (select count(*) from public.submissions where for_student=auth.uid())<>1 then raise exception 'Student cannot see teacher check'; end if;
  if (select count(*) from public.notifications where user_id=auth.uid())<3 then raise exception 'Student notifications missing'; end if;
  update public.notifications set read_at=now() where user_id=auth.uid();
  insert into public.submissions(student_id,title,text_type,input_mode,photo_paths,original_text,question,feedback_lang)
    values(auth.uid(),'Untitled writing','essay','text','{}','என் பள்ளி','என் பள்ளி பற்றி எழுதுக','en');
  perform public.set_question((select id from public.submissions where student_id=auth.uid()), 'என் பள்ளி');
  perform public.my_check_access(auth.uid());
end $$;

-- PARENT sees the child's day
select set_config('request.jwt.claim.sub','f0000000-0000-4000-8000-000000000003',true);
do $$ begin
  if (select count(*) from public.activities)<>1 then raise exception 'Parent cannot see diary'; end if;
  if (select count(*) from public.activity_done)<>1 then raise exception 'Parent cannot see homework ticks'; end if;
  if (select count(*) from public.attendance)<>1 then raise exception 'Parent cannot see attendance'; end if;
  if (select count(*) from public.marks)<>1 then raise exception 'Parent cannot see marks'; end if;
  if (select count(*) from public.reports)<>1 then raise exception 'Parent cannot see report'; end if;
  if (select count(*) from public.submissions)<>2 then raise exception 'Parent cannot see both writings (own + teacher check)'; end if;
  if (select count(*) from public.notifications where user_id=auth.uid())<3 then raise exception 'Parent notifications missing'; end if;
  perform public.my_check_access('f0000000-0000-4000-8000-000000000002');
end $$;

-- TEACHER comments on the student's own writing
select set_config('request.jwt.claim.sub','f0000000-0000-4000-8000-000000000001',true);
do $$ begin
  perform public.set_teacher_comment((select id from public.submissions where student_id='f0000000-0000-4000-8000-000000000002'), 'Well done');
end $$;

-- ADMIN: settings, subscription settings, staff, grant access
select set_config('request.jwt.claim.sub','f0000000-0000-4000-8000-00000000000a',true);
do $$ begin
  update public.school_settings set school_name='Tamil School', school_name_ta='', tagline='', about='', contact_email=null, contact_phone=null,
    address=null, whatsapp_url=null, logo_path=null, hero_path=null, updated_at=now(), tamil_standard='sri_lankan',
    check_limit_hour=0, check_limit_day=0, check_limit_per_writing=0 where id=1;
  update public.school_settings set sub_required=true, sub_price_cents=4500, sub_currency='aud', sub_checks_per_month=0, sub_trial_checks=3, updated_at=now() where id=1;
  perform public.admin_staff();
  perform public.admin_grant_access('f0000000-0000-4000-8000-000000000002', 1, 'Cash');
  if (select count(*) from public.classes c join public.profiles t on t.id=c.teacher_id)<1 then raise exception 'Admin cannot see classes'; end if;
end $$;
select 'PASS: full flows for teacher, student, parent and admin; fixtures rolled back' as result;
rollback;
