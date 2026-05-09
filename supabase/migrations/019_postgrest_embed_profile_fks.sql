-- 019: PostgREST embed fix
-- Context
--   Every user-owning table's user_id FKs to auth.users(id) — so PostgREST
--   can't embed public.profiles through those tables via an explicit FK hint.
--   The result is PGRST200 errors like
--     "Could not find a relationship between 'exam_sessions' and 'user_id'".
--   profiles.user_id has a UNIQUE constraint (profiles_user_id_key), making
--   it a valid FK target. We add parallel direct FKs so every
--   `profiles!<table>_user_profile_fkey(...)` embed resolves cleanly.
--
-- ON DELETE CASCADE matches the existing FK to auth.users so user deletion
-- still cleans these tables up regardless of cascade-order.

alter table public.exam_sessions
  add constraint exam_sessions_user_profile_fkey
  foreign key (user_id) references public.profiles(user_id) on delete cascade;

alter table public.scores
  add constraint scores_user_profile_fkey
  foreign key (user_id) references public.profiles(user_id) on delete cascade;

alter table public.payments
  add constraint payments_user_profile_fkey
  foreign key (user_id) references public.profiles(user_id) on delete cascade;

alter table public.course_access_grants
  add constraint course_access_grants_user_profile_fkey
  foreign key (user_id) references public.profiles(user_id) on delete cascade;

-- admin_audit_log has two auth.users FKs (admin_id, target_user_id) that we
-- also embed profiles through. Add both so `profiles!admin_audit_log_admin_profile_fkey`
-- and `profiles!admin_audit_log_target_profile_fkey` both resolve.
alter table public.admin_audit_log
  add constraint admin_audit_log_admin_profile_fkey
  foreign key (admin_id) references public.profiles(user_id) on delete set null;

alter table public.admin_audit_log
  add constraint admin_audit_log_target_profile_fkey
  foreign key (target_user_id) references public.profiles(user_id) on delete set null;

-- Helpful comments so future maintainers know why there are two FKs per col.
comment on constraint exam_sessions_user_profile_fkey       on public.exam_sessions       is 'Parallel FK to profiles.user_id so PostgREST can embed profiles in admin queries. auth.users FK stays for identity.';
comment on constraint scores_user_profile_fkey              on public.scores              is 'Parallel FK to profiles.user_id for PostgREST embeds.';
comment on constraint payments_user_profile_fkey            on public.payments            is 'Parallel FK to profiles.user_id for PostgREST embeds.';
comment on constraint course_access_grants_user_profile_fkey on public.course_access_grants is 'Parallel FK to profiles.user_id for PostgREST embeds.';
comment on constraint admin_audit_log_admin_profile_fkey    on public.admin_audit_log     is 'Parallel FK to profiles.user_id for PostgREST embeds (admin actor).';
comment on constraint admin_audit_log_target_profile_fkey   on public.admin_audit_log     is 'Parallel FK to profiles.user_id for PostgREST embeds (action target).';
