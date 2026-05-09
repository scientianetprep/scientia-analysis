-- Phase 1 migration 3/5 — create course-thumbnails, course-media, branding
-- buckets + policies.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-thumbnails',
  'course-thumbnails',
  true,
  2 * 1024 * 1024,
  array['image/png','image/jpeg','image/webp','image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-media',
  'course-media',
  false,
  50 * 1024 * 1024,
  array[
    'application/pdf',
    'image/png','image/jpeg','image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
    'text/plain','text/markdown'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'branding',
  'branding',
  true,
  5 * 1024 * 1024,
  array['image/png','image/jpeg','image/webp','image/svg+xml','image/x-icon','image/vnd.microsoft.icon']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "course-thumbnails public read" on storage.objects;
drop policy if exists "course-thumbnails admin write" on storage.objects;
drop policy if exists "course-thumbnails admin update" on storage.objects;
drop policy if exists "course-thumbnails admin delete" on storage.objects;
drop policy if exists "course-media auth read" on storage.objects;
drop policy if exists "course-media admin write" on storage.objects;
drop policy if exists "course-media admin update" on storage.objects;
drop policy if exists "course-media admin delete" on storage.objects;
drop policy if exists "branding public read" on storage.objects;
drop policy if exists "branding admin write" on storage.objects;
drop policy if exists "branding admin update" on storage.objects;
drop policy if exists "branding admin delete" on storage.objects;

create policy "course-thumbnails public read"
  on storage.objects for select
  using (
    bucket_id = 'course-thumbnails'
    and auth.role() in ('anon','authenticated')
    and (storage.foldername(name))[1] is not null
  );

create policy "course-thumbnails admin write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'course-thumbnails' and public.is_admin());

create policy "course-thumbnails admin update"
  on storage.objects for update to authenticated
  using (bucket_id = 'course-thumbnails' and public.is_admin())
  with check (bucket_id = 'course-thumbnails' and public.is_admin());

create policy "course-thumbnails admin delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'course-thumbnails' and public.is_admin());

create policy "course-media auth read"
  on storage.objects for select to authenticated
  using (bucket_id = 'course-media');

create policy "course-media admin write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'course-media' and public.is_admin());

create policy "course-media admin update"
  on storage.objects for update to authenticated
  using (bucket_id = 'course-media' and public.is_admin())
  with check (bucket_id = 'course-media' and public.is_admin());

create policy "course-media admin delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'course-media' and public.is_admin());

create policy "branding public read"
  on storage.objects for select
  using (
    bucket_id = 'branding'
    and auth.role() in ('anon','authenticated')
    and (storage.foldername(name))[1] is not null
  );

create policy "branding admin write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'branding' and public.is_admin());

create policy "branding admin update"
  on storage.objects for update to authenticated
  using (bucket_id = 'branding' and public.is_admin())
  with check (bucket_id = 'branding' and public.is_admin());

create policy "branding admin delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'branding' and public.is_admin());
