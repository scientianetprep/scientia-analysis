-- Migration: 001_create_tables.sql
-- Description: Create profiles and academic_info tables for registration flow

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- PROFILES TABLE
-- =============================================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    cnic TEXT NOT NULL UNIQUE, -- Pakistan CNIC format: 12345-1234567-1
    date_of_birth DATE NOT NULL,
    city TEXT NOT NULL,
    whatsapp_number TEXT NOT NULL, -- WhatsApp number for OTP delivery
    username TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'instructor', 'admin', 'super_admin')),
    mfa_enrolled BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'payment_pending', 'active', 'suspended', 'expired', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- ACADEMIC INFO TABLE
-- =============================================
CREATE TABLE public.academic_info (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Matriculation
    matric_marks DECIMAL(5,2),
    matric_board TEXT,
    matric_year INTEGER,
    matric_subjects JSONB,
    -- Intermediate
    intermediate_marks DECIMAL(5,2),
    intermediate_board TEXT,
    intermediate_year INTEGER,
    intermediate_subjects JSONB,
    -- Calculated
    aggregate_marks DECIMAL(5,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_cnic ON public.profiles(cnic);
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_profiles_status ON public.profiles(status);
CREATE INDEX idx_academic_info_user_id ON public.academic_info(user_id);

-- =============================================
-- UPDATED AT TRIGGER FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TRIGGERS
-- =============================================
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_academic_info_updated_at
    BEFORE UPDATE ON public.academic_info
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();