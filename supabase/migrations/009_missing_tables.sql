-- =====================================================================
-- Migration 009: Missing Tables for Full Feature Set
-- Scientia Prep Platform
-- =====================================================================

-- Account Deletion Requests
-- Referenced in settings/page.tsx but might exist with missing columns
CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reason      TEXT,
    status      TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'approved', 'rejected', 'revoked')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure the newer columns exist if the table was already created
ALTER TABLE public.account_deletion_requests 
    ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS reviewed_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reviewed_by  UUID REFERENCES auth.users(id);

-- Course Access Grants (document download approval + admin revocation)
CREATE TABLE IF NOT EXISTS public.course_access_grants (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id   UUID        NOT NULL,
    granted_by  UUID        REFERENCES auth.users(id),
    granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at  TIMESTAMPTZ,
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE
);

-- Admin Notifications / Banners (broadcast or per-user)
-- target_user_id = NULL means broadcast to all active users
CREATE TABLE IF NOT EXISTS public.admin_notifications (
    id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    title                   TEXT        NOT NULL,
    message                 TEXT        NOT NULL,
    type                    TEXT        NOT NULL DEFAULT 'info'
                                        CHECK (type IN ('info', 'warning', 'alert', 'banner')),
    confirmation_type       TEXT        NOT NULL DEFAULT 'ok'
                                        CHECK (confirmation_type IN ('ok', 'acknowledged', 'custom')),
    custom_confirmation_text TEXT,
    target_user_id          UUID        REFERENCES auth.users(id),
    created_by              UUID        REFERENCES auth.users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at              TIMESTAMPTZ
);

-- User Notification Acknowledgements
CREATE TABLE IF NOT EXISTS public.notification_acknowledgements (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    notification_id UUID        NOT NULL REFERENCES public.admin_notifications(id) ON DELETE CASCADE,
    user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(notification_id, user_id)
);

-- Admin Audit Log (every admin action is recorded here)
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id        UUID        NOT NULL REFERENCES auth.users(id),
    action          TEXT        NOT NULL,
    target_user_id  UUID        REFERENCES auth.users(id),
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Login History
CREATE TABLE IF NOT EXISTS public.login_history (
    id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ip_address   TEXT,
    user_agent   TEXT,
    login_method TEXT,
    success      BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User Preferences (MFA prompt dismiss, leaderboard anonymity, etc.)
CREATE TABLE IF NOT EXISTS public.user_preferences (
    user_id               UUID    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    mfa_prompt_dismissed  BOOLEAN NOT NULL DEFAULT FALSE,
    anonymous_leaderboard BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Student Activity Streaks
CREATE TABLE IF NOT EXISTS public.student_streaks (
    user_id         UUID    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    current_streak  INTEGER NOT NULL DEFAULT 0,
    longest_streak  INTEGER NOT NULL DEFAULT 0,
    last_active_date DATE,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add admin_notes column to courses (for markdown+LaTeX course notes)
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- =====================================================================
-- Enable Row Level Security on All New Tables
-- =====================================================================

ALTER TABLE public.account_deletion_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_access_grants        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notifications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_acknowledgements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_history               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_streaks             ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- RLS Policies
-- =====================================================================

-- account_deletion_requests
CREATE POLICY "users_read_own_deletion"
    ON public.account_deletion_requests FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_deletion"
    ON public.account_deletion_requests FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_revoke_own_deletion"
    ON public.account_deletion_requests FOR UPDATE
    USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "admins_manage_deletions"
    ON public.account_deletion_requests FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

-- course_access_grants
CREATE POLICY "users_read_own_grants"
    ON public.course_access_grants FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "admins_manage_grants"
    ON public.course_access_grants FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

-- admin_notifications (NULL target_user_id = broadcast = readable by all)
CREATE POLICY "users_read_their_notifications"
    ON public.admin_notifications FOR SELECT
    USING (target_user_id IS NULL OR target_user_id = auth.uid());

CREATE POLICY "admins_manage_notifications"
    ON public.admin_notifications FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

-- notification_acknowledgements
CREATE POLICY "users_manage_own_acks"
    ON public.notification_acknowledgements FOR ALL
    USING (auth.uid() = user_id);

-- admin_audit_log (admins read, only service role can insert)
CREATE POLICY "admins_read_audit_log"
    ON public.admin_audit_log FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "service_insert_audit_log"
    ON public.admin_audit_log FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

-- login_history (users see own, admins see all, service role inserts)
CREATE POLICY "users_read_own_login_history"
    ON public.login_history FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "admins_read_all_login_history"
    ON public.login_history FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "service_insert_login_history"
    ON public.login_history FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

-- user_preferences (users manage their own)
CREATE POLICY "users_manage_own_prefs"
    ON public.user_preferences FOR ALL
    USING (auth.uid() = user_id);

-- student_streaks (users see own, admins see all, service manages)
CREATE POLICY "users_read_own_streak"
    ON public.student_streaks FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "admins_read_all_streaks"
    ON public.student_streaks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "service_manage_streaks"
    ON public.student_streaks FOR ALL
    USING (auth.role() = 'service_role');
