-- Migration: 006_registration_state_machine.sql
-- Description: Add registration stage columns, expiration tracking, and cleanup function

-- =============================================
-- REGISTRATION STATE MACHINE COLUMNS
-- =============================================
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS registration_stage INT NOT NULL DEFAULT 1 
  CHECK (registration_stage IN (1, 2, 3, 4)),
ADD COLUMN IF NOT EXISTS registration_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS registration_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- =============================================
-- INDEX FOR EXPIRATION CHECKS
-- =============================================
CREATE INDEX IF NOT EXISTS idx_profiles_expires 
  ON public.profiles(registration_expires_at) 
  WHERE registration_stage < 4;

-- =============================================
-- CASCADE CONSTRAINT (verify FK has CASCADE)
-- =============================================
-- The FK already has ON DELETE CASCADE from migration 001
-- But let's ensure it's explicitly set (no-op if already CASCADE)
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_user_id_fkey,
ADD CONSTRAINT profiles_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- =============================================
-- CLEANUP FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION public.cleanup_expired_registrations()
RETURNS void AS $$
DECLARE
  expired_user RECORD;
BEGIN
  FOR expired_user IN
    SELECT user_id 
    FROM public.profiles 
    WHERE registration_stage < 4 
    AND registration_expires_at < NOW()
    AND registration_expires_at IS NOT NULL
  LOOP
    DELETE FROM auth.users WHERE id = expired_user.user_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- VERIFICATIONS TABLE - STAGE COLUMN
-- =============================================
ALTER TABLE public.verifications
ADD COLUMN IF NOT EXISTS stage INT CHECK (stage IN (1, 2, 3));

-- =============================================
-- CLEANUP STAGE VERIFICATIONS FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION public.cleanup_stage_verifications(user_email TEXT)
RETURNS void AS $$
BEGIN
  DELETE FROM public.verifications 
  WHERE identifier = user_email;
END;
$$ LANGUAGE plpgsql;