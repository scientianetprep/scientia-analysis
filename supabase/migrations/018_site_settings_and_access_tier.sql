-- Phase 4 follow-up migration
-- 1) Creates the singleton `site_settings` table used for branding / site-wide
--    config (logo URL, favicon URL, site name). Task 4.11.
-- 2) Adds `access_tier` to `course_access_grants` so admins can override a
--    course's default tier on a per-student basis. Task 4.8.

-- ---------------------------------------------------------------------------
-- 1. site_settings (singleton row, id = 1)
-- ---------------------------------------------------------------------------
create table if not exists public.site_settings (
  id              int primary key default 1,
  site_name       text not null default 'Scientia Prep',
  logo_url        text,
  favicon_url     text,
  support_email   text,
  primary_color   text,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users(id) on delete set null,
  constraint site_settings_singleton check (id = 1)
);

-- Seed the singleton row
insert into public.site_settings (id, site_name)
values (1, 'Scientia Prep')
on conflict (id) do nothing;

alter table public.site_settings enable row level security;

drop policy if exists "site_settings public read" on public.site_settings;
drop policy if exists "site_settings admin write" on public.site_settings;

-- Public read — the branding is visible to anonymous users on /login etc.
create policy "site_settings public read"
  on public.site_settings for select
  using (true);

-- Only admins can update / insert.
create policy "site_settings admin write"
  on public.site_settings for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

comment on table  public.site_settings is 'Singleton (id=1) holding site-wide branding + config. Publicly readable, admin-only writable.';
comment on column public.site_settings.logo_url     is 'Public URL of the site logo in the `branding` storage bucket.';
comment on column public.site_settings.favicon_url  is 'Public URL of the favicon in the `branding` storage bucket.';

-- ---------------------------------------------------------------------------
-- 2. course_access_grants.access_tier (per-student tier override)
-- ---------------------------------------------------------------------------
alter table public.course_access_grants
  add column if not exists access_tier text
    check (access_tier in ('free','basic','premium','all')) default 'all';

comment on column public.course_access_grants.access_tier is
  'Per-student override of course tier. Defaults to ''all''. Evaluated against courses.tier when gating premium content.';
