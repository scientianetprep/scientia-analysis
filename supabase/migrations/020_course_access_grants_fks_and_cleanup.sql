-- 020_course_access_grants_fks_and_cleanup.sql
--
-- Root cause of "No courses found" (admin) + courses never visible to
-- students even after publishing:
--
-- The admin /admin/courses page server-fetches with a PostgREST embed:
--    select *, lessons(id), course_access_grants(id) from courses
--
-- `course_access_grants` was seeded without ANY foreign keys (see migration
-- 009). PostgREST needs an FK to resolve the embed — when it can't, the
-- whole request returns `{data: null, error: "could not find a relationship..."}`
-- and the page silently falls back to `courses || []` → empty list.
--
-- This migration:
--   1. Adds the three missing FKs on course_access_grants.
--   2. Hard-deletes all test seed courses (per user request). Their lessons
--      cascade via the existing FK.
--
-- Re-runnable: guarded with IF NOT EXISTS / ON CONFLICT DO NOTHING.

begin;

-- 1) Add missing foreign keys so PostgREST embeds resolve.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'course_access_grants_course_id_fkey'
      and conrelid = 'public.course_access_grants'::regclass
  ) then
    alter table public.course_access_grants
      add constraint course_access_grants_course_id_fkey
      foreign key (course_id) references public.courses (id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'course_access_grants_user_id_fkey'
      and conrelid = 'public.course_access_grants'::regclass
  ) then
    alter table public.course_access_grants
      add constraint course_access_grants_user_id_fkey
      foreign key (user_id) references public.profiles (user_id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'course_access_grants_granted_by_fkey'
      and conrelid = 'public.course_access_grants'::regclass
  ) then
    alter table public.course_access_grants
      add constraint course_access_grants_granted_by_fkey
      foreign key (granted_by) references public.profiles (user_id) on delete set null;
  end if;
end
$$;

-- Helpful covering indexes for the FKs (pg_advisor flagged these).
create index if not exists idx_course_access_grants_course_id on public.course_access_grants (course_id);
create index if not exists idx_course_access_grants_user_id on public.course_access_grants (user_id);
create index if not exists idx_course_access_grants_granted_by on public.course_access_grants (granted_by);

-- Nudge PostgREST to reload its schema cache so the new FKs are immediately
-- visible to the API layer without waiting for the usual ~10min TTL.
notify pgrst, 'reload schema';

-- 2) Clean up junk courses per user request. All 13 rows in the DB right
--    now are manual smoke tests ("test", "d", "wef", "sdf", "fdg", "re",
--    "asf", "we", "fghf", "k", "afsa", "czxc", "xzc") — none were ever
--    published and none have enrolled students. Lessons and any
--    course_settings / course_access_grants rows cascade via FK.
delete from public.courses
where title in (
  'test', 'd', 'wef', 'sdf', 'fdg', 're', 'asf', 'we',
  'fghf', 'k', 'afsa', 'czxc', 'xzc'
)
and is_published = false
and deleted_at is null;

commit;
