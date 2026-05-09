-- Migration: 003_functions.sql
-- Description: Helper functions for registration flow

-- =============================================
-- CALCULATE AGGREGATE FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION public.calculate_aggregate(
    p_matric_marks DECIMAL(5,2),
    p_intermediate_marks DECIMAL(5,2)
)
RETURNS DECIMAL(5,2) AS $$
DECLARE
    result DECIMAL(5,2);
BEGIN
    -- Weight: 30% matric, 70% intermediate
    -- Normalize to 100 scale and apply weights
    result := (COALESCE(p_matric_marks, 0) * 0.30) + (COALESCE(p_intermediate_marks, 0) * 0.70);
    RETURN ROUND(result, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================
-- AUTO CREATE PROFILE TRIGGER
-- =============================================
-- This function is called when a new user is created in auth.users
-- to automatically create a pending profile entry
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert a placeholder profile that will be updated during registration
    INSERT INTO public.profiles (user_id, full_name, cnic, date_of_birth, city, whatsapp_number, username, status)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'cnic',
        (NEW.raw_user_meta_data->>'date_of_birth')::DATE,
        NEW.raw_user_meta_data->>'city',
        NEW.raw_user_meta_data->>'whatsapp_number',
        NEW.raw_user_meta_data->>'username',
        'pending'
    )
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- TRIGGER FOR AUTO PROFILE CREATION
-- =============================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- APPROVE USER FUNCTION (admin only)
-- =============================================
CREATE OR REPLACE FUNCTION public.approve_user(
    p_user_id UUID,
    p_approved_by UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.profiles 
    SET status = 'active', updated_at = NOW()
    WHERE user_id = p_user_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- REJECT USER FUNCTION (admin only)
-- =============================================
CREATE OR REPLACE FUNCTION public.reject_user(
    p_user_id UUID,
    p_reason TEXT,
    p_rejected_by UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.profiles 
    SET status = 'rejected', updated_at = NOW()
    WHERE user_id = p_user_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- CUSTOM LOGIN FUNCTION
-- =============================================
-- Allows login by email, cnic, or username
CREATE OR REPLACE FUNCTION public.get_user_by_login(
    p_identifier TEXT
)
RETURNS TABLE(user_id UUID, email TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id AS user_id,
        u.email
    FROM auth.users u
    LEFT JOIN LATERAL (
        SELECT 1 FROM public.profiles p 
        WHERE p.user_id = u.id AND (
            p.cnic = p_identifier 
            OR p.username = p_identifier
            OR u.email = p_identifier
        )
    ) p_matches ON true
    WHERE u.email = p_identifier OR p_matches IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;