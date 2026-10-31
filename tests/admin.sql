-- Transactional tests for admin, settings, phones and notifications. All fixtures are rolled back.
begin;
insert into public.teacher_emails(email, is_admin) values ('adm-principal@example.invalid', true), ('adm-teacher@example.invalid', false);
insert into auth.users(id,email,raw_user_meta_data) values
('a0000000-0000-4000-8000-000000000001','adm-principal@example.invalid','{"role":"teacher","full_name":"Principal"}'),
('a0000000-0000-4000-8000-000000000002','adm-teacher@example.invalid','{"role":"teacher","full_name":"Teacher"}'),
('a0000000-0000-4000-8000-000000000003','adm-student@example.invalid','{"role":"student","full_name":"Student"}'),
('a0000000-0000-4000-8000-000000000004','adm-parent@example.invalid','{"role":"parent","full_name":"Parent"}'),
('a0000000-0000-4000-8000-000000000005','adm-other@example.invalid','{"role":"parent","full_name":"Other"}');
do $$ begin
  if not (select is_admin from public.profiles where id='a0000000-0000-4000-8000-000000000001') then raise exception 'Admin flag not set at signup'; end if;
  if (select is_admin from public.profiles where id='a0000000-0000-4000-8000-000000000002') then raise exception 'Teacher wrongly admin'; end if;
end $$;
insert into public.classes(id,name,teacher_id) values('a1000000-0000-4000-8000-000000000001','Adm class','a0000000-0000-4000-8000-000000000002');
insert into public.class_members(class_id,student_id) values('a1000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000003');
insert into public.parent_links(parent_id,student_id) values('a0000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000003');

set local role authenticated;

-- Parent sets phone and language; cannot make themself admin.
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000004',true);
do $$ begin
  update public.profiles set phone='+61 400 123 456', lang='ta' where id=auth.uid();
  begin update public.profiles set is_admin=true where id=auth.uid(); raise exception 'Self-admin allowed';
  exception when insufficient_privilege then null; end;
  begin update public.profiles set phone='call me' where id=auth.uid(); raise exception 'Bad phone accepted';
  exception when check_violation then null; end;
  begin perform public.admin_staff(); raise exception 'Parent listed staff';
  exception when raise_exception then if sqlerrm not like 'Only the school admin%' then raise; end if; end;
  begin update public.school_settings set school_name='Hacked';
    if (select school_name from public.school_settings)='Hacked' then raise exception 'Parent edited settings'; end if;
  end;
end $$;

-- Class teacher sees parent phone and gets nothing from other classes; activity creates notifications.
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000002',true);
do $$ begin
  if (select phone from public.profiles where id='a0000000-0000-4000-8000-000000000004') is null then raise exception 'Teacher cannot see parent phone'; end if;
  if (select count(*) from public.parent_links)<>1 then raise exception 'Teacher cannot see parent links'; end if;
  if exists (select 1 from public.profiles where id='a0000000-0000-4000-8000-000000000005') then raise exception 'Teacher sees unrelated parent'; end if;
  insert into public.activities(class_id,kind,title) values('a1000000-0000-4000-8000-000000000001','homework','Read');
  insert into public.assessments(id,class_id,title,max_mark) values('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','Test',10);
  insert into public.marks(assessment_id,student_id,mark) values('a2000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000003',8);
  update public.assessments set published=true where id='a2000000-0000-4000-8000-000000000001';
  if (select count(*) from public.notifications)<>0 then raise exception 'Teacher sees others notifications'; end if;
end $$;

-- Student and parent each get their own notifications.
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000003',true);
do $$ begin
  if (select count(*) from public.notifications)<>2 then raise exception 'Student notifications wrong: %', (select count(*) from public.notifications); end if;
  update public.notifications set read_at=now();
  begin update public.notifications set title='x'; raise exception 'Notification title editable';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000004',true);
do $$ begin
  if (select count(*) from public.notifications where title like 'Student: %')<>2 then raise exception 'Parent notifications wrong'; end if;
end $$;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000005',true);
do $$ begin
  if (select count(*) from public.notifications)<>0 then raise exception 'Stranger got notifications'; end if;
end $$;

-- Admin reads across classes, manages staff and settings, moves a class.
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
do $$ begin
  if (select count(*) from public.classes)<>1 or (select count(*) from public.marks)<>1 then raise exception 'Admin cannot read school records'; end if;
  perform public.admin_add_teacher('New.Teacher@example.invalid', false);
  if (select count(*) from public.admin_staff())<>3 then raise exception 'Staff list wrong'; end if;
  perform public.admin_set_admin('adm-teacher@example.invalid', true);
  if not (select is_admin from public.profiles where id='a0000000-0000-4000-8000-000000000002') then raise exception 'Promote failed'; end if;
  perform public.admin_set_admin('adm-teacher@example.invalid', false);
  begin perform public.admin_set_admin('adm-principal@example.invalid', false); raise exception 'Self-demotion allowed';
  exception when raise_exception then if sqlerrm not like 'You cannot%' then raise; end if; end;
  perform public.admin_remove_teacher('new.teacher@example.invalid');
  if (select count(*) from public.admin_staff())<>2 then raise exception 'Remove failed'; end if;
  if public.admin_reassign_class('a1000000-0000-4000-8000-000000000001','adm-principal@example.invalid')<>'Principal' then raise exception 'Reassign failed'; end if;
  update public.school_settings set school_name='Melbourne Tamil School', whatsapp_url='https://chat.whatsapp.com/abc';
  if (select school_name from public.school_settings)<>'Melbourne Tamil School' then raise exception 'Admin settings update failed'; end if;
  begin update public.school_settings set whatsapp_url='https://evil.example/'; raise exception 'Bad WhatsApp link accepted';
  exception when check_violation then null; end;
end $$;

-- Visitors can read settings only.
reset role; set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
  if (select school_name from public.school_settings)<>'Melbourne Tamil School' then raise exception 'Anon cannot read settings'; end if;
  begin perform 1 from public.notifications; raise exception 'Anon read notifications';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
select 'PASS: admin, staff, settings, parent phones, notifications; fixtures rolled back' as result;
rollback;
