-- =====================================================================
-- Migration 010: Courses Phase 2 (Content Architecture)
-- =====================================================================

-- Course taxonomy
CREATE TABLE IF NOT EXISTS public.course_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#4f8ef7',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Course settings (access, gating, seo, metadata)
CREATE TABLE IF NOT EXISTS public.course_settings (
  course_id UUID PRIMARY KEY REFERENCES public.courses(id) ON DELETE CASCADE,
  payment_mode TEXT NOT NULL DEFAULT 'free' CHECK (payment_mode IN ('free', 'paid')),
  included_plans TEXT[] NOT NULL DEFAULT '{}',
  enrollment_mode TEXT NOT NULL DEFAULT 'open' CHECK (enrollment_mode IN ('open', 'batch', 'admin')),
  max_enrollment INTEGER,
  waitlist_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  prerequisite_course_ids UUID[] NOT NULL DEFAULT '{}',
  sequential_mode BOOLEAN NOT NULL DEFAULT FALSE,
  completion_threshold TEXT NOT NULL DEFAULT 'video_80' CHECK (completion_threshold IN ('video_80', 'document_opened', 'quiz_passed')),
  lesson_time_lock_days INTEGER,
  seo_title TEXT,
  seo_description TEXT,
  seo_keywords TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Section headers inside course lesson list
CREATE TABLE IF NOT EXISTS public.lesson_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES public.lesson_sections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS order_index INTEGER;

UPDATE public.lessons
SET order_index = COALESCE(order_index, sequence_order, 0)
WHERE order_index IS NULL;

-- Lesson resources
CREATE TABLE IF NOT EXISTS public.lesson_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Shared media library catalog
CREATE TABLE IF NOT EXISTS public.media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id UUID REFERENCES auth.users(id),
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
  bucket TEXT NOT NULL DEFAULT 'course-media',
  object_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  size_bytes BIGINT,
  source TEXT NOT NULL DEFAULT 'lesson' CHECK (source IN ('lesson', 'library', 'course_thumbnail')),
  reference_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Extend courses table for richer editor fields
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS short_description TEXT,
  ADD COLUMN IF NOT EXISTS long_description TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.course_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS difficulty TEXT CHECK (difficulty IN ('Beginner', 'Intermediate', 'Advanced')),
  ADD COLUMN IF NOT EXISTS estimated_duration_hours INTEGER,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_slug_unique_not_deleted
  ON public.courses(slug)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_course_settings_updated_at ON public.course_settings(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_lessons_course_order ON public.lessons(course_id, order_index);
CREATE INDEX IF NOT EXISTS idx_lesson_sections_course_order ON public.lesson_sections(course_id, order_index);
CREATE INDEX IF NOT EXISTS idx_media_assets_course_created ON public.media_assets(course_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_assets_lesson_created ON public.media_assets(lesson_id, created_at DESC);

-- Default settings row for existing courses
INSERT INTO public.course_settings (course_id)
SELECT c.id
FROM public.courses c
LEFT JOIN public.course_settings cs ON cs.course_id = c.id
WHERE cs.course_id IS NULL;

