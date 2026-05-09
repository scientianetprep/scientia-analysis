-- Phase 3 migration 017
-- Root-cause: code-vs-DB drift on two constraints.
-- 1. academic_info.matric_status column is written by AcademicUpdateModal +
--    AcademicInfoBanner but was never created (schema cache error).
-- 2. payments.status = 'paid' is written in several code paths
--    (POST /api/admin/payments, admin UI buttons, STATUS_CONFIG) but the
--    check constraint only allows (pending, completed, failed, rejected,
--    refunded). We accept 'paid' as a first-class status so the code and
--    DB speak the same language.

alter table public.academic_info
  add column if not exists matric_status text
  check (matric_status in ('Declared', 'Awaiting', 'Appeared', 'Pending'));

-- Drop + rebuild payments_status_check to include 'paid'.
alter table public.payments
  drop constraint if exists payments_status_check;

alter table public.payments
  add constraint payments_status_check
  check (status in ('pending','paid','completed','failed','rejected','refunded'));

comment on column public.academic_info.matric_status is
  'Declared | Awaiting | Appeared | Pending — mirrors intermediate_status.';
