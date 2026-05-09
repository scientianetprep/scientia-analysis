-- Phase 1 migration 1/5 — canonical role-check helpers used by every
-- public.* RLS policy.
-- SECURITY DEFINER + fixed search_path prevents policy recursion and
-- ensures a consistent result across client/server/edge calls.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = auth.uid()
      and role in ('admin', 'super_admin', 'examiner')
      and coalesce(status, 'active') in ('active', 'scheduled_for_deletion')
  );
$$;

create or replace function public.is_active_student()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = auth.uid()
      and role = 'student'
      and coalesce(status, 'active') = 'active'
  );
$$;

create or replace function public.is_authenticated()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select auth.uid() is not null; $$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_active_student() to authenticated;
grant execute on function public.is_authenticated() to authenticated;

comment on function public.is_admin() is 'Returns true when the current JWT belongs to an admin profile. Used by RLS.';
comment on function public.is_active_student() is 'Returns true when the current JWT belongs to an active student profile. Used by RLS.';
