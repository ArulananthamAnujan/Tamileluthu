-- Tamil school portal: daily diary, attendance, listening/other resources,
-- marks, term reports for parents, and a paper shop.
-- Apply AFTER 0001_schema.sql and 20261031050145_harden_student_access.sql.
-- Every rule is enforced here with row level security, not in the website.

-- ---------------------------------------------------------------
-- Access helpers (private schema, security definer, no recursion)
-- ---------------------------------------------------------------
create function private.is_class_parent(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.parent_links pl
                 join public.class_members m on m.student_id = pl.student_id
                 where pl.parent_id = auth.uid() and m.class_id = cid)
$$;

-- Teacher of the class, a student in it, or a parent of a student in it.
create function private.in_class(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_class_teacher(cid) or private.is_class_member(cid) or private.is_class_parent(cid)
$$;

create function private.student_in_class(cid uuid, sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.class_members where class_id = cid and student_id = sid)
$$;

-- The student themself or one of their linked parents.
create function private.is_self_or_parent(sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select sid = auth.uid() or private.is_parent_of(sid)
$$;

-- Class teacher may write records for a student who is in that class.
create function private.can_record(cid uuid, sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_class_teacher(cid) and private.student_in_class(cid, sid)
$$;

do $$ declare f text; begin
  foreach f in array array['is_class_parent(uuid)','in_class(uuid)','student_in_class(uuid,uuid)',
                           'is_self_or_parent(uuid)','can_record(uuid,uuid)'] loop
    execute format('revoke all on function private.%s from public, anon', f);
    execute format('grant execute on function private.%s to authenticated, service_role', f);
  end loop;
end $$;

-- Parents can see the classes and memberships of their own children.
create policy classes_select_parent on public.classes for select to authenticated
  using (private.is_class_parent(id));
create policy members_select_parent on public.class_members for select to authenticated
  using (private.is_parent_of(student_id));
-- Parents can see the teacher of their child's class (name only is shown).
create function private.teaches_my_child(tid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.classes c
                 join public.class_members m on m.class_id = c.id
                 join public.parent_links pl on pl.student_id = m.student_id
                 where c.teacher_id = tid and pl.parent_id = auth.uid())
$$;
revoke all on function private.teaches_my_child(uuid) from public, anon;
grant execute on function private.teaches_my_child(uuid) to authenticated, service_role;
create policy profiles_select_class_teacher on public.profiles for select to authenticated
  using (private.teaches_my_child(id));

-- ---------------------------------------------------------------
-- Daily diary: homework, classwork, announcements, events
-- ---------------------------------------------------------------
create table public.activities (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references public.classes on delete cascade,
  kind        text not null default 'homework'
              check (kind in ('homework','classwork','announcement','event','reminder')),
  title       text not null check (char_length(trim(title)) between 1 and 200),
  body        text not null default '' check (char_length(body) <= 5000),
  link_url    text check (link_url is null or (link_url ~* '^https?://' and char_length(link_url) <= 1000)),
  on_date     date not null default current_date,
  due_on      date,
  notified_at timestamptz,
  created_by  uuid not null default auth.uid() references public.profiles on delete cascade,
  created_at  timestamptz not null default now()
);
create index activities_class_date on public.activities(class_id, on_date desc);

create table public.activity_done (
  activity_id uuid not null references public.activities on delete cascade,
  student_id  uuid not null default auth.uid() references public.profiles on delete cascade,
  done_at     timestamptz not null default now(),
  primary key (activity_id, student_id)
);

create function private.activity_class(aid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select class_id from public.activities where id = aid
$$;
revoke all on function private.activity_class(uuid) from public, anon;
grant execute on function private.activity_class(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------
-- Attendance
-- ---------------------------------------------------------------
create table public.attendance (
  class_id    uuid not null references public.classes on delete cascade,
  student_id  uuid not null references public.profiles on delete cascade,
  on_date     date not null,
  status      text not null check (status in ('present','absent','late','excused')),
  note        text check (note is null or char_length(note) <= 300),
  marked_by   uuid not null default auth.uid() references public.profiles on delete cascade,
  marked_at   timestamptz not null default now(),
  primary key (class_id, student_id, on_date)
);
create index attendance_student on public.attendance(student_id, on_date desc);

-- ---------------------------------------------------------------
-- Resources: listening exams and other links for a class
-- ---------------------------------------------------------------
create table public.resources (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references public.classes on delete cascade,
  kind        text not null default 'listening'
              check (kind in ('listening','reading','speaking','past_paper','video','other')),
  title       text not null check (char_length(trim(title)) between 1 and 200),
  description text not null default '' check (char_length(description) <= 3000),
  url         text not null check (url ~* '^https?://' and char_length(url) <= 1000),
  answers_url text check (answers_url is null or (answers_url ~* '^https?://' and char_length(answers_url) <= 1000)),
  show_answers boolean not null default false,
  due_on      date,
  created_by  uuid not null default auth.uid() references public.profiles on delete cascade,
  created_at  timestamptz not null default now()
);
create index resources_class on public.resources(class_id, created_at desc);

-- ---------------------------------------------------------------
-- Assessments and marks
-- ---------------------------------------------------------------
create table public.assessments (
  id           uuid primary key default gen_random_uuid(),
  class_id     uuid not null references public.classes on delete cascade,
  title        text not null check (char_length(trim(title)) between 1 and 200),
  kind         text not null default 'test'
               check (kind in ('test','exam','listening','reading','speaking','writing','homework','other')),
  max_mark     numeric(7,2) not null default 100 check (max_mark > 0 and max_mark <= 1000),
  held_on      date not null default current_date,
  resource_id  uuid references public.resources on delete set null,
  published    boolean not null default false,
  published_at timestamptz,
  notified_at  timestamptz,
  created_by   uuid not null default auth.uid() references public.profiles on delete cascade,
  created_at   timestamptz not null default now()
);
create index assessments_class on public.assessments(class_id, held_on desc);

create table public.marks (
  assessment_id uuid not null references public.assessments on delete cascade,
  student_id    uuid not null references public.profiles on delete cascade,
  mark          numeric(7,2) check (mark is null or mark >= 0),
  absent        boolean not null default false,
  comment       text check (comment is null or char_length(comment) <= 1000),
  updated_at    timestamptz not null default now(),
  primary key (assessment_id, student_id)
);
create index marks_student on public.marks(student_id);

create function private.assessment_class(aid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select class_id from public.assessments where id = aid
$$;
create function private.assessment_published(aid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select published from public.assessments where id = aid), false)
$$;
revoke all on function private.assessment_class(uuid), private.assessment_published(uuid) from public, anon;
grant execute on function private.assessment_class(uuid), private.assessment_published(uuid) to authenticated, service_role;

create function private.check_mark() returns trigger
language plpgsql security definer set search_path = '' as $$
declare mx numeric;
begin
  select max_mark into mx from public.assessments where id = new.assessment_id;
  if new.mark is not null and new.mark > mx then
    raise exception 'Mark % is more than the maximum (%).', new.mark, mx using errcode = 'check_violation';
  end if;
  if new.absent then new.mark := null; end if;
  new.updated_at := now();
  return new;
end $$;
revoke all on function private.check_mark() from public, anon, authenticated;
create trigger marks_check before insert or update on public.marks
  for each row execute function private.check_mark();

create function private.stamp_published() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.published and (tg_op = 'INSERT' or not old.published) then new.published_at := now(); end if;
  if not new.published then new.published_at := null; end if;
  return new;
end $$;
revoke all on function private.stamp_published() from public, anon, authenticated;
create trigger assessments_published before insert or update on public.assessments
  for each row execute function private.stamp_published();

-- ---------------------------------------------------------------
-- Term reports
-- ---------------------------------------------------------------
create table public.reports (
  id           uuid primary key default gen_random_uuid(),
  class_id     uuid not null references public.classes on delete cascade,
  student_id   uuid not null references public.profiles on delete cascade,
  term         text not null check (char_length(trim(term)) between 1 and 60),
  period_start date,
  period_end   date,
  skills       jsonb not null default '{}' check (jsonb_typeof(skills) = 'object' and char_length(skills::text) <= 4000),
  effort       text check (effort is null or char_length(effort) <= 40),
  behaviour    text check (behaviour is null or char_length(behaviour) <= 40),
  strengths    text check (strengths is null or char_length(strengths) <= 2000),
  next_steps   text check (next_steps is null or char_length(next_steps) <= 2000),
  comment      text check (comment is null or char_length(comment) <= 3000),
  published    boolean not null default false,
  published_at timestamptz,
  notified_at  timestamptz,
  created_by   uuid not null default auth.uid() references public.profiles on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (class_id, student_id, term),
  check (period_start is null or period_end is null or period_start <= period_end)
);
create index reports_student on public.reports(student_id);
create trigger reports_published before insert or update on public.reports
  for each row execute function private.stamp_published();

-- ---------------------------------------------------------------
-- Row level security for the school tables
-- ---------------------------------------------------------------
alter table public.activities    enable row level security;
alter table public.activity_done enable row level security;
alter table public.attendance    enable row level security;
alter table public.resources     enable row level security;
alter table public.assessments   enable row level security;
alter table public.marks         enable row level security;
alter table public.reports       enable row level security;

-- activities
create policy activities_select on public.activities for select to authenticated
  using (private.in_class(class_id));
create policy activities_insert on public.activities for insert to authenticated
  with check (private.is_class_teacher(class_id) and created_by = auth.uid());
create policy activities_update on public.activities for update to authenticated
  using (private.is_class_teacher(class_id)) with check (private.is_class_teacher(class_id));
create policy activities_delete on public.activities for delete to authenticated
  using (private.is_class_teacher(class_id));

-- activity_done: students tick their own; teacher and parents can see.
create policy done_select on public.activity_done for select to authenticated
  using (private.is_self_or_parent(student_id) or private.is_class_teacher(private.activity_class(activity_id)));
create policy done_insert on public.activity_done for insert to authenticated
  with check (student_id = auth.uid() and private.is_class_member(private.activity_class(activity_id)));
create policy done_delete on public.activity_done for delete to authenticated
  using (student_id = auth.uid());

-- attendance
create policy attendance_select on public.attendance for select to authenticated
  using (private.is_class_teacher(class_id) or private.is_self_or_parent(student_id));
create policy attendance_insert on public.attendance for insert to authenticated
  with check (private.can_record(class_id, student_id) and marked_by = auth.uid());
create policy attendance_update on public.attendance for update to authenticated
  using (private.is_class_teacher(class_id))
  with check (private.can_record(class_id, student_id) and marked_by = auth.uid());
create policy attendance_delete on public.attendance for delete to authenticated
  using (private.is_class_teacher(class_id));

-- resources
create policy resources_select on public.resources for select to authenticated
  using (private.in_class(class_id));
create policy resources_insert on public.resources for insert to authenticated
  with check (private.is_class_teacher(class_id) and created_by = auth.uid());
create policy resources_update on public.resources for update to authenticated
  using (private.is_class_teacher(class_id)) with check (private.is_class_teacher(class_id));
create policy resources_delete on public.resources for delete to authenticated
  using (private.is_class_teacher(class_id));

-- assessments: students/parents see only published ones.
create policy assessments_select on public.assessments for select to authenticated
  using (private.is_class_teacher(class_id) or (published and private.in_class(class_id)));
create policy assessments_insert on public.assessments for insert to authenticated
  with check (private.is_class_teacher(class_id) and created_by = auth.uid());
create policy assessments_update on public.assessments for update to authenticated
  using (private.is_class_teacher(class_id)) with check (private.is_class_teacher(class_id));
create policy assessments_delete on public.assessments for delete to authenticated
  using (private.is_class_teacher(class_id));

-- marks: only the student's own (and their parents'), only once published.
create policy marks_select on public.marks for select to authenticated
  using (private.is_class_teacher(private.assessment_class(assessment_id))
         or (private.assessment_published(assessment_id) and private.is_self_or_parent(student_id)));
create policy marks_insert on public.marks for insert to authenticated
  with check (private.can_record(private.assessment_class(assessment_id), student_id));
create policy marks_update on public.marks for update to authenticated
  using (private.is_class_teacher(private.assessment_class(assessment_id)))
  with check (private.can_record(private.assessment_class(assessment_id), student_id));
create policy marks_delete on public.marks for delete to authenticated
  using (private.is_class_teacher(private.assessment_class(assessment_id)));

-- reports: student/parents see published reports only.
create policy reports_select on public.reports for select to authenticated
  using (private.is_class_teacher(class_id) or (published and private.is_self_or_parent(student_id)));
create policy reports_insert on public.reports for insert to authenticated
  with check (private.can_record(class_id, student_id) and created_by = auth.uid());
create policy reports_update on public.reports for update to authenticated
  using (private.is_class_teacher(class_id)) with check (private.can_record(class_id, student_id));
create policy reports_delete on public.reports for delete to authenticated
  using (private.is_class_teacher(class_id));

revoke all on public.activities, public.activity_done, public.attendance, public.resources,
  public.assessments, public.marks, public.reports from anon, authenticated;
grant select on public.activities, public.activity_done, public.attendance, public.resources,
  public.assessments, public.marks, public.reports to authenticated;
grant insert (id, class_id, kind, title, body, link_url, on_date, due_on, created_by),
      update (kind, title, body, link_url, on_date, due_on), delete on public.activities to authenticated;
grant insert (activity_id, student_id), delete on public.activity_done to authenticated;
grant insert (class_id, student_id, on_date, status, note, marked_by),
      update (class_id, student_id, on_date, status, note, marked_by, marked_at), delete on public.attendance to authenticated;
grant insert (id, class_id, kind, title, description, url, answers_url, show_answers, due_on, created_by),
      update (kind, title, description, url, answers_url, show_answers, due_on), delete on public.resources to authenticated;
grant insert (id, class_id, title, kind, max_mark, held_on, resource_id, published, created_by),
      update (title, kind, max_mark, held_on, resource_id, published), delete on public.assessments to authenticated;
grant insert (assessment_id, student_id, mark, absent, comment),
      update (assessment_id, student_id, mark, absent, comment), delete on public.marks to authenticated;
grant insert (id, class_id, student_id, term, period_start, period_end, skills, effort, behaviour, strengths, next_steps, comment, published, created_by),
      update (term, period_start, period_end, skills, effort, behaviour, strengths, next_steps, comment, published, updated_at), delete
  on public.reports to authenticated;
grant all on public.activities, public.activity_done, public.attendance, public.resources,
  public.assessments, public.marks, public.reports to service_role;

-- ---------------------------------------------------------------
-- Paper shop: past papers, listening packs, notes (own or other authors')
-- ---------------------------------------------------------------
create table public.products (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(trim(title)) between 1 and 200),
  description  text not null default '' check (char_length(description) <= 5000),
  author       text not null default '' check (char_length(author) <= 200),
  level        text not null default '' check (char_length(level) <= 100),
  kind         text not null default 'paper' check (kind in ('paper','listening','notes','bundle','other')),
  price_cents  integer not null default 0 check (price_cents between 0 and 10000000),
  currency     text not null default 'aud' check (currency ~ '^[a-z]{3}$'),
  file_path    text check (file_path is null or char_length(file_path) <= 300),
  external_url text check (external_url is null or (external_url ~* '^https?://' and char_length(external_url) <= 1000)),
  active       boolean not null default true,
  seller_id    uuid not null default auth.uid() references public.profiles on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (file_path is null or file_path ~ ('^' || seller_id::text || '/[0-9a-fA-F-]{36}\.(pdf|mp3|m4a|zip|docx)$'))
);
create index products_active on public.products(active, created_at desc);

create table public.purchases (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references public.products on delete cascade,
  buyer_id          uuid not null references public.profiles on delete cascade,
  status            text not null default 'pending' check (status in ('pending','paid','refunded')),
  amount_cents      integer not null default 0,
  currency          text not null default 'aud',
  method            text not null default 'stripe' check (method in ('stripe','manual','free')),
  stripe_session_id text unique,
  created_at        timestamptz not null default now(),
  paid_at           timestamptz
);
create index purchases_buyer on public.purchases(buyer_id);
create index purchases_product on public.purchases(product_id);
create unique index purchases_one_paid on public.purchases(product_id, buyer_id) where status = 'paid';

create function private.is_seller(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.products where id = pid and seller_id = auth.uid())
$$;
create function private.can_download(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.products p where p.id = pid and (
           p.seller_id = auth.uid()
           or (p.active and p.price_cents = 0)
           or exists (select 1 from public.purchases b where b.product_id = p.id
                      and b.buyer_id = auth.uid() and b.status = 'paid')))
$$;
create function private.can_download_path(path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.products p where p.file_path = path and private.can_download(p.id))
$$;
revoke all on function private.is_seller(uuid), private.can_download(uuid), private.can_download_path(text) from public, anon;
grant execute on function private.is_seller(uuid), private.can_download(uuid), private.can_download_path(text) to authenticated, service_role;

alter table public.products  enable row level security;
alter table public.purchases enable row level security;

-- Anyone (even signed out) can browse the active catalogue.
create policy products_select_anon on public.products for select to anon
  using (active);
create policy products_select on public.products for select to authenticated
  using (active or seller_id = auth.uid() or private.can_download(id));
create policy products_insert on public.products for insert to authenticated
  with check (seller_id = auth.uid() and private.my_role() = 'teacher');
create policy products_update on public.products for update to authenticated
  using (seller_id = auth.uid()) with check (seller_id = auth.uid());
create policy products_delete on public.products for delete to authenticated
  using (seller_id = auth.uid());

create policy purchases_select on public.purchases for select to authenticated
  using (buyer_id = auth.uid() or private.is_seller(product_id));

revoke all on public.products, public.purchases from anon, authenticated;
grant select (id, title, description, author, level, kind, price_cents, currency, external_url, active, seller_id, created_at)
  on public.products to anon;
grant select on public.products to authenticated;
grant insert (id, title, description, author, level, kind, price_cents, currency, file_path, external_url, active, seller_id),
      update (title, description, author, level, kind, price_cents, currency, file_path, external_url, active, updated_at),
      delete on public.products to authenticated;
grant select on public.purchases to authenticated;
grant all on public.products, public.purchases to service_role;

-- Free papers: record the "purchase" so the buyer finds it under My papers.
create function private.claim_free(pid uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  if not exists (select 1 from public.products where id = pid and active and price_cents = 0) then
    raise exception 'This item is not free.';
  end if;
  insert into public.purchases(product_id, buyer_id, status, method, paid_at)
  values (pid, auth.uid(), 'paid', 'free', now())
  on conflict (product_id, buyer_id) where status = 'paid' do nothing;
end $$;

-- Seller records a cash or bank-transfer sale for a registered account.
create function private.grant_product(pid uuid, buyer_email text) returns text
language plpgsql security definer set search_path = '' as $$
declare b record; p record;
begin
  select * into p from public.products where id = pid and seller_id = auth.uid();
  if p.id is null then raise exception 'You can only give access to your own items.'; end if;
  select pr.id, pr.full_name into b from auth.users u join public.profiles pr on pr.id = u.id
   where lower(u.email) = lower(trim(buyer_email));
  if b.id is null then raise exception 'No account uses that email. Ask the buyer to create an account first.'; end if;
  insert into public.purchases(product_id, buyer_id, status, amount_cents, currency, method, paid_at)
  values (pid, b.id, 'paid', p.price_cents, p.currency, 'manual', now())
  on conflict (product_id, buyer_id) where status = 'paid' do nothing;
  return coalesce(nullif(b.full_name, ''), 'the buyer');
end $$;

revoke all on function private.claim_free(uuid), private.grant_product(uuid, text) from public, anon, authenticated;
grant execute on function private.claim_free(uuid), private.grant_product(uuid, text) to authenticated, service_role;
create function public.claim_free(pid uuid) returns void language sql security invoker set search_path = ''
  as $$ select private.claim_free(pid) $$;
create function public.grant_product(pid uuid, buyer_email text) returns text language sql security invoker set search_path = ''
  as $$ select private.grant_product(pid, buyer_email) $$;
revoke all on function public.claim_free(uuid), public.grant_product(uuid, text) from public, anon;
grant execute on function public.claim_free(uuid), public.grant_product(uuid, text) to authenticated, service_role;

-- Paper files: private bucket; download only for the seller, free items, or buyers.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('papers', 'papers', false, 52428800,
        array['application/pdf','audio/mpeg','audio/mp4','audio/x-m4a','application/zip',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

create policy papers_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'papers' and (storage.foldername(name))[1] = auth.uid()::text
              and private.my_role() = 'teacher');
create policy papers_select on storage.objects for select to authenticated
  using (bucket_id = 'papers' and ((storage.foldername(name))[1] = auth.uid()::text
                                   or private.can_download_path(name)));
create policy papers_delete on storage.objects for delete to authenticated
  using (bucket_id = 'papers' and (storage.foldername(name))[1] = auth.uid()::text);

notify pgrst, 'reload schema';
