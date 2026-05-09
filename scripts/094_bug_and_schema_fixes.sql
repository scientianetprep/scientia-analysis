-- scripts/094_bug_and_schema_fixes.sql
-- Resolves a batch of live-production bugs caused by schema drift between the
-- application code and the Supabase database. Every block is idempotent.

begin;

-- 1) site_settings — seed the singleton row so Branding/Admin save stop
--    erroring with "Cannot coerce the result to a single JSON object"
insert into public.site_settings (id, site_name)
values (1, 'Scientia Prep')
on conflict (id) do nothing;

-- 2) exam_sessions.ended_at — referenced by /api/admin/proctor/terminate and
--    the admin user-detail view. Distinct from submitted_at: ended_at is
--    written by the proctor force-terminate and by the auto-submit paths,
--    while submitted_at is always the student-authored finish timestamp.
alter table public.exam_sessions
  add column if not exists ended_at timestamptz;

-- 3) academic_info — add every column the recalculate route relies on.
alter table public.academic_info
  add column if not exists entrance_test_marks numeric,
  add column if not exists entrance_test_total integer,
  add column if not exists aggregate_marks numeric,
  add column if not exists updated_at timestamptz default now();

-- 4) academic_info.intermediate_status — legacy values were lower-case
--    (`completed|pending|appeared`) but the UI + matric_status both use
--    Title-case (`Declared|Awaiting|Appeared|Pending`). Normalize existing
--    rows, then swap the CHECK so saves stop failing.
alter table public.academic_info
  drop constraint if exists academic_info_intermediate_status_check;

update public.academic_info set intermediate_status = 'Declared'
  where intermediate_status = 'completed';
update public.academic_info set intermediate_status = 'Pending'
  where intermediate_status = 'pending';
update public.academic_info set intermediate_status = 'Appeared'
  where intermediate_status = 'appeared';

alter table public.academic_info
  add constraint academic_info_intermediate_status_check
  check (
    intermediate_status is null
    or intermediate_status in ('Declared', 'Awaiting', 'Appeared', 'Pending')
  );

-- 5) courses.visibility — make the 3-way CHECK explicit so the admin
--    course-config UI can't accidentally persist a typo.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'courses_visibility_check'
  ) then
    alter table public.courses
      add constraint courses_visibility_check
      check (visibility in ('open', 'restricted', 'private'));
  end if;
end$$;

commit;
