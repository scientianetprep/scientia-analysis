-- Migration: 004_custom_claims.sql
-- Description: Custom JWT claims function to inject role, status, mfa_enrolled into tokens

-- Drop existing function if present (for recreation)
DROP FUNCTION IF EXISTS auth.custom_claims();

-- Custom claims function - auto-injects role/status/mfa_enrolled into JWT
CREATE OR REPLACE FUNCTION auth.custom_claims()
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'role', p.role,
    'status', p.status,
    'mfa_enrolled', p.mfa_enrolled,
    'user_id', p.user_id
  )
  FROM public.profiles p
  WHERE p.user_id = auth.uid();
$$;

-- Grant execute on function to authenticated role
GRANT EXECUTE ON FUNCTION auth.custom_claims() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.custom_claims() TOanon;
GRANT EXECUTE ON FUNCTION auth.custom_claims() TO service_role;