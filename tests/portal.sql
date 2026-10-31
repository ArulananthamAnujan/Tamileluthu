-- Transactional tests for the school portal (diary, attendance, marks, reports, shop).
-- Run against a test database after all migrations. All fixtures are rolled back.
begin;
insert into public.teacher_emails(email) values('portal-teacher@example.invalid'),('portal-teacher2@example.invalid');
insert into auth.users(id,email,raw_user_meta_data) values
('11111111-1111-4111-8111-111111111111','portal-s1@example.invalid','{"role":"student","full_name":"S One"}'),
('22222222-2222-4222-8222-222222222222','portal-s2@example.invalid','{"role":"student","full_name":"S Two"}'),
('33333333-3333-4333-8333-333333333333','portal-p1@example.invalid','{"role":"parent","full_name":"P One"}'),
('44444444-4444-4444-8444-444444444444','portal-teacher@example.invalid','{"role":"teacher","full_name":"T One"}'),
('55555555-5555-4555-8555-555555555555','portal-teacher2@example.invalid','{"role":"teacher","full_name":"T Two"}'),
('66666666-6666-4666-8666-666666666666','portal-p2@example.invalid','{"role":"parent","full_name":"P Two"}');
insert into public.classes(id,name,teacher_id) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Class A','44444444-4444-4444-8444-444444444444'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Class B','55555555-5555-4555-8555-555555555555');
insert into public.class_members(class_id,student_id) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111'),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222');
insert into public.parent_links(parent_id,student_id) values('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111');

set local role authenticated;
-- Teacher A records everything for class A.
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
do $$ begin
 insert into public.activities(id,class_id,kind,title) values('cccccccc-0001-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','homework','Read page 4');
 insert into public.attendance(class_id,student_id,on_date,status) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','2026-10-31','present'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','2026-10-31','absent');
 insert into public.attendance(class_id,student_id,on_date,status) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','2026-10-31','late')
  on conflict (class_id,student_id,on_date) do update set status=excluded.status, class_id=excluded.class_id, student_id=excluded.student_id, on_date=excluded.on_date;
 insert into public.resources(class_id,title,url) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Listening 1','https://example.org/l1');
 insert into public.assessments(id,class_id,title,kind,max_mark) values
  ('dddddddd-0001-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Listening test','listening',20),
  ('dddddddd-0002-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Draft test','test',50);
 insert into public.marks(assessment_id,student_id,mark) values
  ('dddddddd-0001-4000-8000-000000000001','11111111-1111-4111-8111-111111111111',17),
  ('dddddddd-0001-4000-8000-000000000001','22222222-2222-4222-8222-222222222222',12),
  ('dddddddd-0002-4000-8000-000000000002','11111111-1111-4111-8111-111111111111',40);
 begin
  insert into public.marks(assessment_id,student_id,mark) values('dddddddd-0002-4000-8000-000000000002','22222222-2222-4222-8222-222222222222',51);
  raise exception 'Mark above maximum accepted';
 exception when check_violation then null; end;
 update public.assessments set published=true where id='dddddddd-0001-4000-8000-000000000001';
 if (select published_at from public.assessments where id='dddddddd-0001-4000-8000-000000000001') is null then raise exception 'published_at not stamped'; end if;
 insert into public.reports(id,class_id,student_id,term,comment,published) values
  ('eeeeeeee-0001-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Term 4 2026','Great work',true),
  ('eeeeeeee-0002-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','Term 4 2026','Draft',false);
 begin
  update public.reports set notified_at=now();
  raise exception 'Teacher could set notified_at';
 exception when insufficient_privilege then null; end;
 insert into public.products(id,title,price_cents,seller_id) values
  ('ffffffff-0001-4000-8000-000000000001','Free paper',0,auth.uid()),
  ('ffffffff-0002-4000-8000-000000000002','Paid paper',1500,auth.uid());
 update public.products set file_path=auth.uid()::text||'/ffffffff-0002-4000-8000-000000000002.pdf' where id='ffffffff-0002-4000-8000-000000000002';
 begin
  update public.products set file_path='55555555-5555-4555-8555-555555555555/ffffffff-0002-4000-8000-000000000002.pdf' where id='ffffffff-0002-4000-8000-000000000002';
  raise exception 'Foreign product file path accepted';
 exception when check_violation then null; end;
end $$;

-- Teacher B cannot see or write class A records.
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',true);
do $$ begin
 if (select count(*) from public.activities)<>0 or (select count(*) from public.marks)<>0
  or (select count(*) from public.reports)<>0 or (select count(*) from public.attendance)<>0 then raise exception 'Other teacher sees class A'; end if;
 begin
  insert into public.attendance(class_id,student_id,on_date,status) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','2026-11-01','present');
  raise exception 'Other teacher wrote attendance';
 exception when insufficient_privilege then null; end;
 -- Own class, but the student must be in it.
 begin
  insert into public.attendance(class_id,student_id,on_date,status) values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','2026-11-01','present');
  raise exception 'Attendance for non-member accepted';
 exception when insufficient_privilege then null; end;
 begin
  update public.products set price_cents=0;
  if exists (select 1 from public.products where price_cents=0 and title='Paid paper') then raise exception 'Other seller changed price'; end if;
 end;
end $$;

-- Student 1 sees own published data only.
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$ begin
 if (select count(*) from public.activities)<>1 then raise exception 'Student cannot see diary'; end if;
 insert into public.activity_done(activity_id) values('cccccccc-0001-4000-8000-000000000001');
 if (select count(*) from public.marks)<>1 then raise exception 'Student mark visibility wrong'; end if;
 if (select count(*) from public.assessments)<>1 then raise exception 'Unpublished assessment visible'; end if;
 if (select count(*) from public.attendance)<>1 then raise exception 'Student attendance visibility wrong'; end if;
 if (select count(*) from public.reports)<>1 then raise exception 'Student report visibility wrong'; end if;
 begin
  update public.marks set mark=20;
  if (select mark from public.marks)<>17 then raise exception 'Student changed mark'; end if;
 exception when insufficient_privilege then null; end;
 begin
  insert into public.attendance(class_id,student_id,on_date,status) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','2026-11-02','present');
  raise exception 'Student wrote attendance';
 exception when insufficient_privilege then null; end;
 if private.can_download('ffffffff-0002-4000-8000-000000000002') then raise exception 'Unpaid download allowed'; end if;
 if not private.can_download('ffffffff-0001-4000-8000-000000000001') then raise exception 'Free download refused'; end if;
 perform public.claim_free('ffffffff-0001-4000-8000-000000000001');
 begin
  perform public.claim_free('ffffffff-0002-4000-8000-000000000002');
  raise exception 'Paid item claimed free';
 exception when raise_exception then if sqlerrm not like '%not free%' then raise; end if; end;
 begin
  insert into public.purchases(product_id,buyer_id,status) values('ffffffff-0002-4000-8000-000000000002',auth.uid(),'paid');
  raise exception 'Student forged a purchase';
 exception when insufficient_privilege then null; end;
end $$;

-- Student 2 sees only their own marks/reports (nothing published for the report).
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$ begin
 if (select count(*) from public.marks)<>1 or (select mark from public.marks)<>12 then raise exception 'Student 2 mark visibility wrong'; end if;
 if (select count(*) from public.reports)<>0 then raise exception 'Draft report visible'; end if;
 if (select count(*) from public.activity_done)<>0 then raise exception 'Other student ticks visible'; end if;
end $$;

-- Parent 1 sees only their child.
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
do $$ begin
 if (select count(*) from public.marks)<>1 or (select student_id from public.marks)<>'11111111-1111-4111-8111-111111111111' then raise exception 'Parent mark visibility wrong'; end if;
 if (select count(*) from public.reports)<>1 then raise exception 'Parent report visibility wrong'; end if;
 if (select count(*) from public.attendance)<>1 then raise exception 'Parent attendance visibility wrong'; end if;
 if (select count(*) from public.activities)<>1 then raise exception 'Parent cannot see diary'; end if;
 if (select count(*) from public.activity_done)<>1 then raise exception 'Parent cannot see homework ticks'; end if;
 if (select count(*) from public.classes)<>1 then raise exception 'Parent class visibility wrong'; end if;
 if (select count(*) from public.profiles where role='teacher')<>1 then raise exception 'Parent cannot see child teacher'; end if;
end $$;

-- Unlinked parent sees nothing.
select set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666666',true);
do $$ begin
 if (select count(*) from public.marks)+(select count(*) from public.reports)+(select count(*) from public.attendance)
   +(select count(*) from public.activities)+(select count(*) from public.resources)<>0 then raise exception 'Stranger parent sees data'; end if;
 begin
  insert into public.products(title,seller_id) values('Parent product',auth.uid());
  raise exception 'Parent created a product';
 exception when insufficient_privilege then null; end;
end $$;

-- Seller gives manual access; buyer can then download.
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select public.grant_product('ffffffff-0002-4000-8000-000000000002','PORTAL-P2@example.invalid');
select set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666666',true);
do $$ begin
 if not private.can_download('ffffffff-0002-4000-8000-000000000002') then raise exception 'Manual grant failed'; end if;
 if (select count(*) from public.purchases)<>1 then raise exception 'Buyer purchase visibility wrong'; end if;
end $$;

-- Anonymous visitors can browse active products, without file paths.
reset role; set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
 if (select count(*) from public.products)<>2 then raise exception 'Anon catalogue wrong'; end if;
 begin
  perform file_path from public.products;
  raise exception 'Anon read file paths';
 exception when insufficient_privilege then null; end;
 begin
  perform 1 from public.marks;
  raise exception 'Anon read marks';
 exception when insufficient_privilege then null; end;
end $$;

reset role;
select 'PASS: diary, attendance, marks, reports, parent scope, shop access; fixtures rolled back' as result;
rollback;
