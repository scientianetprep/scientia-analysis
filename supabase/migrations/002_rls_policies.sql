-- Migration: 002_rls_policies.sql
-- Description: Row Level Security policies for profiles and academic_info

-- =============================================
-- ENABLE RLS
-- =============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_info ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PROFILES POLICIES
-- =============================================

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
    ON public.profiles
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can update their own profile (only certain fields)
CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Admins can read all profiles
CREATE POLICY "Admins can read all profiles"
    ON public.profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Admins can update all profiles
CREATE POLICY "Admins can update all profiles"
    ON public.profiles
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Service role can do everything (for migrations/scripts)
CREATE POLICY "Service role full access to profiles"
    ON public.profiles
    FOR ALL
    USING (auth.role() = 'service_role');

-- =============================================
-- ACADEMIC INFO POLICIES
-- =============================================

-- Users can read their own academic info
CREATE POLICY "Users can read own academic info"
    ON public.academic_info
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own academic info
CREATE POLICY "Users can insert own academic info"
    ON public.academic_info
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own academic info
CREATE POLICY "Users can update own academic info"
    ON public.academic_info
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Admins can read all academic info
CREATE POLICY "Admins can read all academic info"
    ON public.academic_info
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Admins can update all academic info
CREATE POLICY "Admins can update all academic info"
    ON public.academic_info
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Service role can do everything
CREATE POLICY "Service role full access to academic_info"
    ON public.academic_info
    FOR ALL
    USING (auth.role() = 'service_role');