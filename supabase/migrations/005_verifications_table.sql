-- Migration: 005_verifications_table.sql
-- Description: Table to store pre-registration verification codes (OTPs)

CREATE TABLE IF NOT EXISTS public.verifications (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    identifier TEXT NOT NULL,           -- phone or email
    code TEXT NOT NULL,                 -- hashed or plain (since it's short-lived)
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INTEGER DEFAULT 0,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;

-- Only service role can access this table (server-side only)
CREATE POLICY "Service role full access to verifications"
    ON public.verifications
    FOR ALL
    USING (auth.role() = 'service_role');

-- Create an index on identifier for fast lookups
CREATE INDEX IF NOT EXISTS idx_verifications_identifier ON public.verifications(identifier);

-- Function to prune expired verifications (optional but good for hygiene)
CREATE OR REPLACE FUNCTION public.prune_expired_verifications()
RETURNS void AS $$
BEGIN
    DELETE FROM public.verifications WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
