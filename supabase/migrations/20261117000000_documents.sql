-- Documents: a teacher uploads a file once and shares it with one or more
-- classes (batches). More classes can be added, or removed, at any time.
-- Apply AFTER 20261116000000_practice_editor.sql.
-- Every rule is enforced here with row level security, not in the website.

create table public.documents (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references public.profiles on delete cascade,
  title      text not null check (char_length(trim(title)) between 1 and 200),
  note       text not null default '' check (char_length(note) <= 1000),
  file_path  text not null unique,
  file_name  text not null check (char_length(file_name) between 1 and 200),
  size       bigint not null default 0 check (size >= 0),
  created_at timestamptz not null default now(),
  -- The file sits in the owner's own folder: <owner id>/<file id>.<type>
  check (file_path ~ ('^' || owner_id::text || '/[0-9a-f-]{36}\.(pdf|doc|docx|ppt|pptx|xls|xlsx|txt|jpg|jpeg|png|mp3|m4a)$'))
);
create index documents_owner on public.documents(owner_id, created_at desc);

create table public.document_classes (
  document_id uuid not null references public.documents on delete cascade,
  class_id    uuid not null references public.classes on delete cascade,
  shared_by   uuid not null default auth.uid() references public.profiles on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (document_id, class_id)
);
create index document_classes_class on public.document_classes(class_id, created_at desc);

create function private.owns_document(did uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.documents where id = did and owner_id = auth.uid())
$$;
-- Shared with a class I teach, am in, or my child is in.
create function private.document_shared_to_me(did uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.document_classes dc where dc.document_id = did and private.in_class(dc.class_id))
$$;
create function private.can_open_document_path(path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.documents d where d.file_path = path
                 and (d.owner_id = auth.uid() or private.document_shared_to_me(d.id) or private.is_admin()))
$$;
revoke all on function private.owns_document(uuid), private.document_shared_to_me(uuid), private.can_open_document_path(text) from public, anon;
grant execute on function private.owns_document(uuid), private.document_shared_to_me(uuid), private.can_open_document_path(text)
  to authenticated, service_role;

alter table public.documents        enable row level security;
alter table public.document_classes enable row level security;

create policy documents_select on public.documents for select to authenticated
  using (owner_id = auth.uid() or private.document_shared_to_me(id) or private.is_admin());
create policy documents_insert on public.documents for insert to authenticated
  with check (owner_id = auth.uid() and private.my_role() = 'teacher');
create policy documents_update on public.documents for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy documents_delete on public.documents for delete to authenticated
  using (owner_id = auth.uid());

-- A teacher shares their own documents with their own classes; an admin with any class.
create policy document_classes_select on public.document_classes for select to authenticated
  using (private.in_class(class_id) or private.owns_document(document_id) or private.is_admin());
create policy document_classes_insert on public.document_classes for insert to authenticated
  with check (shared_by = auth.uid() and private.owns_document(document_id)
              and (private.is_class_teacher(class_id) or private.is_admin()));
create policy document_classes_delete on public.document_classes for delete to authenticated
  using (private.owns_document(document_id) or private.is_class_teacher(class_id));

do $$ declare tb text; begin
  foreach tb in array array['documents', 'document_classes'] loop
    execute format('create policy %I on public.%I as restrictive for all to authenticated
                    using (private.is_approved()) with check (private.is_approved())', tb || '_approved_only', tb);
  end loop;
end $$;

revoke all on public.documents, public.document_classes from anon, authenticated;
grant select on public.documents, public.document_classes to authenticated;
grant insert (id, owner_id, title, note, file_path, file_name, size), update (title, note), delete on public.documents to authenticated;
grant insert (document_id, class_id, shared_by), delete on public.document_classes to authenticated;
grant all on public.documents, public.document_classes to service_role;

-- Tell the class (and parents) when a document is shared with them.
create function private.on_document_shared() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify_students(private.class_students(new.class_id), 'resource',
    'New document: ' || (select title from public.documents where id = new.document_id), '', '#/documents');
  return new;
end $$;
revoke all on function private.on_document_shared() from public, anon, authenticated;
create trigger document_classes_notify after insert on public.document_classes
  for each row execute function private.on_document_shared();

-- Files: private bucket. The owner uploads into their own folder; anyone the
-- document is shared with can open it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 26214400,
        array['application/pdf', 'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/vnd.ms-powerpoint',
              'application/vnd.openxmlformats-officedocument.presentationml.presentation',
              'application/vnd.ms-excel',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'text/plain', 'image/jpeg', 'image/png', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a'])
on conflict (id) do nothing;

create policy documents_file_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text
              and private.my_role() = 'teacher');
create policy documents_file_select on storage.objects for select to authenticated
  using (bucket_id = 'documents' and ((storage.foldername(name))[1] = auth.uid()::text
                                      or private.can_open_document_path(name)));
create policy documents_file_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

notify pgrst, 'reload schema';
