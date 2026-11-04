-- Account approval: students and parents wait for the admin; teachers do not.
-- All fixtures roll back.
begin;
insert into public.teacher_emails(email, is_admin) values('ap-admin@example.invalid', true),('ap-t@example.invalid', false);
insert into auth.users(id,email,raw_user_meta_data) values
('a9000000-0000-4000-8000-00000000000a','ap-admin@example.invalid','{"role":"teacher","full_name":"Principal"}'),
('a9000000-0000-4000-8000-000000000001','ap-t@example.invalid','{"role":"teacher","full_name":"Teacher"}'),
('a9000000-0000-4000-8000-000000000002','ap-s@example.invalid','{"role":"student","full_name":"Kavin"}'),
('a9000000-0000-4000-8000-000000000003','ap-p@example.invalid','{"role":"parent","full_name":"Parent"}'),
('a9000000-0000-4000-8000-000000000004','ap-x@example.invalid','{"role":"student","full_name":"Spam"}');

do $$ begin
  if not (select approved from public.profiles where id='a9000000-0000-4000-8000-000000000001') then raise exception 'Teacher should be approved automatically'; end if;
  if (select approved from public.profiles where id='a9000000-0000-4000-8000-000000000002') then raise exception 'Student should wait for approval'; end if;
  if (select approved from public.profiles where id='a9000000-0000-4000-8000-000000000003') then raise exception 'Parent should wait for approval'; end if;
  if (select count(*) from public.notifications where user_id='a9000000-0000-4000-8000-00000000000a' and link like '#/admin%')<>3 then
    raise exception 'Admin should get one notification per waiting sign-up'; end if;
  if exists (select 1 from public.notifications where user_id='a9000000-0000-4000-8000-000000000001') then
    raise exception 'Non-admin teachers should not get sign-up notifications'; end if;
end $$;
-- School details start empty and can be left empty.
update public.school_settings set school_name = '' where id = 1;

set local role authenticated;
-- Teacher makes a class.
select set_config('request.jwt.claim.sub','a9000000-0000-4000-8000-000000000001',true);
do $$ declare cid uuid; begin
  insert into public.classes(name,teacher_id) values('Year 5',auth.uid()) returning id into cid;
  perform set_config('ap.code', (select join_code from public.classes where id=cid), true);
end $$;

-- WAITING STUDENT: sees own profile, can change own name, nothing else.
select set_config('request.jwt.claim.sub','a9000000-0000-4000-8000-000000000002',true);
do $$ begin
  if (select count(*) from public.profiles where id=auth.uid())<>1 then raise exception 'Waiting student must see own profile'; end if;
  update public.profiles set full_name='Kavin K' where id=auth.uid();
  if (select full_name from public.profiles where id=auth.uid())<>'Kavin K' then raise exception 'Waiting student should be able to fix own name'; end if;
  if (select count(*) from public.profiles where id<>auth.uid())<>0 then raise exception 'Waiting student must not see other profiles'; end if;
  begin perform public.join_class(current_setting('ap.code')); raise exception 'JOINED';
  exception when others then if sqlerrm='JOINED' then raise exception 'Waiting student could join a class'; end if; end;
  begin perform public.my_check_access(auth.uid()); raise exception 'ACCESS';
  exception when others then if sqlerrm='ACCESS' then raise exception 'Waiting student could start the checker'; end if; end;
  begin
    insert into public.submissions(student_id,title,text_type,input_mode,photo_paths,original_text)
    values(auth.uid(),'x','essay','text','{}','தமிழ்'); raise exception 'SUBMITTED';
  exception when others then if sqlerrm='SUBMITTED' then raise exception 'Waiting student could submit writing'; end if; end;
end $$;
-- Cannot approve themselves.
do $$ begin
  update public.profiles set approved=true where id=auth.uid(); raise exception 'SELF';
exception when others then if sqlerrm='SELF' then raise exception 'Student approved themselves'; end if; end $$;
do $$ begin
  perform public.admin_set_approved(auth.uid(), true); raise exception 'SELF';
exception when others then if sqlerrm='SELF' then raise exception 'Student approved themselves via admin function'; end if; end $$;

-- WAITING PARENT cannot link a child.
select set_config('request.jwt.claim.sub','a9000000-0000-4000-8000-000000000003',true);
do $$ begin
  perform public.link_child('ANYCODE1'); raise exception 'LINKED';
exception when others then if sqlerrm='LINKED' then raise exception 'Waiting parent could link a child'; end if; end $$;

-- A teacher who is not admin cannot approve.
select set_config('request.jwt.claim.sub','a9000000-0000-4000-8000-000000000001',true);
do $$ begin
  perform public.admin_set_approved('a9000000-0000-4000-8000-000000000002', true); raise exception 'OK';
exception when others then if sqlerrm='OK' then raise exception 'Non-admin teacher approved an account'; end if; end $$;

-- ADMIN: lists waiting accounts, approves the student and parent, declines the spam one.
select set_config('request.jwt.claim.sub','a9000000-0000-4000-8000-00000000000a',true);
do $$ begin
  if (select count(*) from public.admin_accounts() where not approved and email like 'ap-%')<>3 then raise exception 'Admin should see 3 waiting accounts'; end if;
  perform public.admin_set_approved('a9000000-0000-4000-8000-000000000002', true);
  perform public.admin_set_approved('a9000000-0000-4000-8000-000000000003', true);
  perform public.admin_decline('a9000000-0000-4000-8000-000000000004');
  begin perform public.admin_decline('a9000000-0000-4000-8000-000000000002'); raise exception 'DECLINED';
  exception when others then if sqlerrm='DECLINED' then raise exception 'Admin could delete an approved account'; end if; end;
end $$;
reset role;
do $$ begin
  if exists (select 1 from auth.users where id='a9000000-0000-4000-8000-000000000004') then raise exception 'Declined account should be deleted'; end if;
  if not exists (select 1 from public.notifications where user_id='a9000000-0000-4000-8000-000000000002' and title like 'Your account is approved%') then
    raise exception 'Approved student should be told'; end if;
end $$;
set local role authenticated;

-- APPROVED STUDENT can now join and see the class; parent can link.
select set_config('request.jwt.claim.sub','a9000000-0000-4000-8000-000000000002',true);
do $$ declare pc text; begin
  perform public.join_class(current_setting('ap.code'));
  if (select count(*) from public.classes)<>1 then raise exception 'Approved student cannot see class'; end if;
  pc := public.new_parent_code(); perform set_config('ap.pc', pc, true);
end $$;
select set_config('request.jwt.claim.sub','a9000000-0000-4000-8000-000000000003',true);
do $$ begin
  perform public.link_child(current_setting('ap.pc'));
  if (select count(*) from public.parent_links where parent_id=auth.uid())<>1 then raise exception 'Approved parent cannot link child'; end if;
end $$;

-- BLOCKED: admin takes approval away; the student loses access straight away.
select set_config('request.jwt.claim.sub','a9000000-0000-4000-8000-00000000000a',true);
select public.admin_set_approved('a9000000-0000-4000-8000-000000000002', false);
select set_config('request.jwt.claim.sub','a9000000-0000-4000-8000-000000000002',true);
do $$ begin
  if (select count(*) from public.classes)<>0 or (select count(*) from public.class_members)<>0 then
    raise exception 'Blocked student still sees the class'; end if;
end $$;
-- The class teacher still sees the student in the class list.
select set_config('request.jwt.claim.sub','a9000000-0000-4000-8000-000000000001',true);
do $$ begin
  if (select count(*) from public.class_members)<>1 then raise exception 'Teacher lost the class list'; end if;
end $$;
rollback;
