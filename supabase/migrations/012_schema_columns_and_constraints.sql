-- Phase 1 migration 2/5 — add missing columns (academic_info.intermediate_status
-- / matric_total / intermediate_total, profiles.deletion_scheduled_at) and
-- repair check constraints for payments.status and profiles.status.

-- 1. academic_info missing columns
alter table public.academic_info
  add column if not exists intermediate_status text check (intermediate_status in ('completed','pending','appeared')),
  add column if not exists matric_total integer,
  add column if not exists intermediate_total integer;

-- 2. profiles deletion scheduling
alter table public.profiles
  add column if not exists deletion_scheduled_at timestamptz;

-- 3. Repair payments status check to allow 'rejected' (and 'refunded' for completeness)
do $$
declare
  c_name text;
begin
  select conname into c_name
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  where c.relname = 'payments'
    and c.relnamespace = 'public'::regnamespace
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%status%';
  if c_name is not null then
    execute format('alter table public.payments drop constraint %I', c_name);
  end if;
end $$;

alter table public.payments
  add constraint payments_status_check
  check (status in ('pending','completed','failed','rejected','refunded'));

-- 4. Repair profiles status check to allow 'scheduled_for_deletion'
do $$
declare
  c_name text;
begin
  select conname into c_name
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  where c.relname = 'profiles'
    and c.relnamespace = 'public'::regnamespace
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%status%';
  if c_name is not null then
    execute format('alter table public.profiles drop constraint %I', c_name);
  end if;
end $$;

alter table public.profiles
  add constraint profiles_status_check
  check (status in ('pending','active','suspended','scheduled_for_deletion'));

-- 5. Useful indexes for queries used in P2 "scheduled for deletion" flow
create index if not exists profiles_deletion_scheduled_at_idx
  on public.profiles (deletion_scheduled_at)
  where deletion_scheduled_at is not null;

comment on column public.profiles.deletion_scheduled_at is '7-day grace window end. NULL = not scheduled. Cron hard-deletes rows once this is in the past.';
comment on column public.academic_info.intermediate_status is 'completed | pending | appeared (student still sitting the exam).';
