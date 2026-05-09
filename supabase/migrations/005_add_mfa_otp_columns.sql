-- Migration: 005_add_mfa_otp_columns.sql
-- Description: Add MFA OTP columns for SMS-based verification

-- Add OTP columns for MFA verification
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS mfa_otp TEXT,
ADD COLUMN IF NOT EXISTS mfa_otp_expires TIMESTAMPTZ;

-- Create index for OTP lookup performance
CREATE INDEX IF NOT EXISTS idx_profiles_mfa_otp ON public.profiles(user_id, mfa_otp, mfa_otp_expires);