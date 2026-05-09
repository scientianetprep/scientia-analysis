-- Phase 2 migration 016
-- Repair the account_deletion_requests status check so every status the
-- app writes is legal:
--   pending   — new request from user
--   processing— admin currently working on it
--   scheduled — admin approved; 7-day grace window running
--   completed — hard-delete executed (after grace)
--   cancelled — user revoked from settings / banner
--   rejected  — admin rejected the request
--   revoked   — alias for cancelled (kept for /api/user/deletion/revoke compat)

alter table public.account_deletion_requests
  drop constraint if exists account_deletion_requests_status_check;

alter table public.account_deletion_requests
  add constraint account_deletion_requests_status_check
  check (
    status in (
      'pending',
      'processing',
      'scheduled',
      'completed',
      'cancelled',
      'rejected',
      'revoked'
    )
  );

-- Defensive: ensure deletion_scheduled_at exists. Phase 1 migration 012
-- added it already; this is safe to re-run in fresh/test environments.
alter table public.profiles
  add column if not exists deletion_scheduled_at timestamptz;

create index if not exists profiles_deletion_scheduled_at_idx
  on public.profiles (deletion_scheduled_at)
  where deletion_scheduled_at is not null;

comment on column public.profiles.deletion_scheduled_at is
  '7-day grace window end. NULL = not scheduled. Cron hard-deletes rows once this is in the past.';
