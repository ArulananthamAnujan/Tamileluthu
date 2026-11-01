-- Attendance: the database stamps marked_at itself on every save (the app
-- no longer sends it, since clients may not write that column on insert).
create or replace function private.attendance_stamp() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.marked_at := now();
  return new;
end $$;
revoke all on function private.attendance_stamp() from public, anon, authenticated;

drop trigger if exists attendance_stamp on public.attendance;
create trigger attendance_stamp before insert or update on public.attendance
  for each row execute function private.attendance_stamp();
