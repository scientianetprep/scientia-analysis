-- Migration 021 — courses.visibility access model
--
-- Adds a real access-model column to `public.courses` so the student-side
-- lesson gate can distinguish "open to everyone" from "grant-required"
-- without having to look up each student's enrollment row. Before this,
-- the P5.3 gate treated every course without a grant as locked, which
-- meant admins creating a plain published course would see it marked
-- Locked in the student view even though they never configured any
-- restriction. The user reported exactly this.
--
-- Values
--   'open'       - Any authenticated student can view every published lesson.
--                  Default for new courses and backfilled onto existing rows.
--   'restricted' - Requires an active course_access_grants row. Visible in
--                  /dashboard/courses as Locked, opens the enrollment card
--                  instead of the lesson.
--   'private'    - Same gating as restricted plus hidden from the library
--                  list entirely unless the student already has a grant.
--
-- Applied to production on 2026-04-23.

alter table public.courses
  add column if not exists visibility text
    check (visibility in ('open','restricted','private')) default 'open';

update public.courses set visibility = 'open' where visibility is null;

create index if not exists idx_courses_visibility on public.courses (visibility);

comment on column public.courses.visibility is
  'Access model. open: any authenticated student can view. restricted: requires an active course_access_grants row. private: same as restricted plus hidden from /dashboard/courses.';

notify pgrst, 'reload schema';
