-- Migration: 008_admin_security_reinforcement.sql
-- Description: Reinforced RLS policies for admin-level security (Layer 4)
-- Includes support for super_admin role and protects questions/tests tables.

-- =============================================
-- PROFILES REINFORCEMENT
-- =============================================

-- Ensure super_admin has same privileges as admin
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles"
    ON public.profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
        )
    );

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
    ON public.profiles
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
        )
    );

-- =============================================
-- ACADEMIC INFO REINFORCEMENT
-- =============================================

DROP POLICY IF EXISTS "Admins can read all academic info" ON public.academic_info;
CREATE POLICY "Admins can read all academic info"
    ON public.academic_info
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
        )
    );

DROP POLICY IF EXISTS "Admins can update all academic info" ON public.academic_info;
CREATE POLICY "Admins can update all academic info"
    ON public.academic_info
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
        )
    );

-- =============================================
-- QUESTIONS & TESTS PROTECTION
-- =============================================

-- Enable RLS (Safety Check)
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;

-- Questions Policies
DROP POLICY IF EXISTS "Anyone can read approved questions" ON public.questions;
CREATE POLICY "Anyone can read approved questions"
    ON public.questions
    FOR SELECT
    USING (status = 'approved');

DROP POLICY IF EXISTS "Admins can manage all questions" ON public.questions;
CREATE POLICY "Admins can manage all questions"
    ON public.questions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
        )
    );

-- Tests Policies
DROP POLICY IF EXISTS "Anyone can read published tests" ON public.tests;
CREATE POLICY "Anyone can read published tests"
    ON public.tests
    FOR SELECT
    USING (is_published = true);

DROP POLICY IF EXISTS "Admins can manage all tests" ON public.tests;
CREATE POLICY "Admins can manage all tests"
    ON public.tests
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
        )
    );
