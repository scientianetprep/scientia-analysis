-- Phase 1 migration 4/5 — canonical RLS rewrite across all public.* tables.
-- Every policy uses public.is_admin() / public.is_active_student() / auth.uid().

-- profiles
alter table public.profiles enable row level security;
drop policy if exists "profiles self select" on public.profiles;
drop policy if exists "profiles insert self" on public.profiles;
drop policy if exists "profiles self update" on public.profiles;
drop policy if exists "profiles admin all" on public.profiles;
drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Admins manage profiles" on public.profiles;

create policy "profiles self select" on public.profiles
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "profiles insert self" on public.profiles
  for insert to authenticated
  with check (user_id = auth.uid() or public.is_admin());
create policy "profiles self update" on public.profiles
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
create policy "profiles admin all" on public.profiles
  for delete to authenticated
  using (public.is_admin());

-- academic_info
alter table public.academic_info enable row level security;
drop policy if exists "academic_info self" on public.academic_info;
drop policy if exists "Users manage own academic info" on public.academic_info;
drop policy if exists "Admins view all academic info" on public.academic_info;

create policy "academic_info self" on public.academic_info
  for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- account_deletion_requests
alter table public.account_deletion_requests enable row level security;
drop policy if exists "adr self select" on public.account_deletion_requests;
drop policy if exists "adr self insert" on public.account_deletion_requests;
drop policy if exists "adr self update" on public.account_deletion_requests;
drop policy if exists "adr admin delete" on public.account_deletion_requests;
drop policy if exists "Users create deletion request" on public.account_deletion_requests;
drop policy if exists "Users view own deletion request" on public.account_deletion_requests;
drop policy if exists "Users request deletion" on public.account_deletion_requests;
drop policy if exists "Admins manage deletion requests" on public.account_deletion_requests;

create policy "adr self select" on public.account_deletion_requests
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "adr self insert" on public.account_deletion_requests
  for insert to authenticated
  with check (user_id = auth.uid());
create policy "adr self update" on public.account_deletion_requests
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
create policy "adr admin delete" on public.account_deletion_requests
  for delete to authenticated
  using (public.is_admin());

-- admin_notifications (announcements)
alter table public.admin_notifications enable row level security;
drop policy if exists "an read targeted or broadcast" on public.admin_notifications;
drop policy if exists "an admin all" on public.admin_notifications;

create policy "an read targeted or broadcast" on public.admin_notifications
  for select to authenticated
  using (public.is_admin() or target_user_id is null or target_user_id = auth.uid());
create policy "an admin all" on public.admin_notifications
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- notification_acknowledgements
alter table public.notification_acknowledgements enable row level security;
drop policy if exists "na self" on public.notification_acknowledgements;
drop policy if exists "na admin all" on public.notification_acknowledgements;

create policy "na self" on public.notification_acknowledgements
  for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- admin_audit_log
alter table public.admin_audit_log enable row level security;
drop policy if exists "aal admin read" on public.admin_audit_log;

create policy "aal admin read" on public.admin_audit_log
  for select to authenticated
  using (public.is_admin());

-- feedback
alter table public.feedback enable row level security;
drop policy if exists "feedback self insert" on public.feedback;
drop policy if exists "feedback self read" on public.feedback;
drop policy if exists "feedback admin all" on public.feedback;
drop policy if exists "Users submit feedback" on public.feedback;
drop policy if exists "Users view own feedback" on public.feedback;
drop policy if exists "Admins manage feedback" on public.feedback;

create policy "feedback self insert" on public.feedback
  for insert to authenticated
  with check (user_id = auth.uid());
create policy "feedback self read" on public.feedback
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "feedback admin all" on public.feedback
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- courses
alter table public.courses enable row level security;
drop policy if exists "courses read published" on public.courses;
drop policy if exists "courses admin all" on public.courses;
drop policy if exists "Published courses visible" on public.courses;
drop policy if exists "Admins manage courses" on public.courses;

create policy "courses read published" on public.courses
  for select to authenticated
  using (coalesce(is_published, false) = true or public.is_admin());
create policy "courses admin all" on public.courses
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- tests
alter table public.tests enable row level security;
drop policy if exists "tests read published" on public.tests;
drop policy if exists "tests admin all" on public.tests;
drop policy if exists "Examiners manage tests" on public.tests;
drop policy if exists "Active students view tests" on public.tests;

create policy "tests read published" on public.tests
  for select to authenticated
  using (coalesce(is_published, false) = true or public.is_admin());
create policy "tests admin all" on public.tests
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- questions
alter table public.questions enable row level security;
drop policy if exists "questions admin all" on public.questions;
drop policy if exists "questions auth read" on public.questions;
drop policy if exists "Admins manage questions" on public.questions;

create policy "questions admin all" on public.questions
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "questions auth read" on public.questions
  for select to authenticated
  using (public.is_admin() or public.is_active_student());

-- lessons
alter table public.lessons enable row level security;
drop policy if exists "lessons read" on public.lessons;
drop policy if exists "lessons admin all" on public.lessons;

create policy "lessons read" on public.lessons
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.courses c
      where c.id = lessons.course_id and coalesce(c.is_published, false) = true
    )
  );
create policy "lessons admin all" on public.lessons
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- lesson_sections (course_id !)
alter table public.lesson_sections enable row level security;
drop policy if exists "lesson_sections read" on public.lesson_sections;
drop policy if exists "lesson_sections admin all" on public.lesson_sections;

create policy "lesson_sections read" on public.lesson_sections
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.courses c
      where c.id = lesson_sections.course_id and coalesce(c.is_published, false) = true
    )
  );
create policy "lesson_sections admin all" on public.lesson_sections
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- lesson_resources
alter table public.lesson_resources enable row level security;
drop policy if exists "lesson_resources read" on public.lesson_resources;
drop policy if exists "lesson_resources admin all" on public.lesson_resources;

create policy "lesson_resources read" on public.lesson_resources
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.lessons l
      join public.courses c on c.id = l.course_id
      where l.id = lesson_resources.lesson_id and coalesce(c.is_published, false) = true
    )
  );
create policy "lesson_resources admin all" on public.lesson_resources
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- lesson_completions
alter table public.lesson_completions enable row level security;
drop policy if exists "lc self" on public.lesson_completions;
drop policy if exists "lc admin" on public.lesson_completions;

create policy "lc self" on public.lesson_completions
  for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- course_settings
alter table public.course_settings enable row level security;
drop policy if exists "course_settings read" on public.course_settings;
drop policy if exists "course_settings admin all" on public.course_settings;

create policy "course_settings read" on public.course_settings
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.courses c
      where c.id = course_settings.course_id and coalesce(c.is_published, false) = true
    )
  );
create policy "course_settings admin all" on public.course_settings
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- course_categories
alter table public.course_categories enable row level security;
drop policy if exists "course_categories read" on public.course_categories;
drop policy if exists "course_categories admin all" on public.course_categories;

create policy "course_categories read" on public.course_categories
  for select to authenticated
  using (true);
create policy "course_categories admin all" on public.course_categories
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- media_assets
alter table public.media_assets enable row level security;
drop policy if exists "media_assets read" on public.media_assets;
drop policy if exists "media_assets admin all" on public.media_assets;

create policy "media_assets read" on public.media_assets
  for select to authenticated
  using (
    public.is_admin()
    or (
      media_assets.course_id is not null
      and exists (
        select 1 from public.courses c
        where c.id = media_assets.course_id and coalesce(c.is_published, false) = true
      )
    )
  );
create policy "media_assets admin all" on public.media_assets
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- course_access_grants
alter table public.course_access_grants enable row level security;
drop policy if exists "cag self select" on public.course_access_grants;
drop policy if exists "cag admin all" on public.course_access_grants;

create policy "cag self select" on public.course_access_grants
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "cag admin all" on public.course_access_grants
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- exam_sessions
alter table public.exam_sessions enable row level security;
drop policy if exists "exam_sessions self" on public.exam_sessions;
drop policy if exists "exam_sessions admin" on public.exam_sessions;
drop policy if exists "Users view own sessions" on public.exam_sessions;
drop policy if exists "Users create own sessions" on public.exam_sessions;
drop policy if exists "Users update own sessions" on public.exam_sessions;
drop policy if exists "Admins view all sessions" on public.exam_sessions;

create policy "exam_sessions self" on public.exam_sessions
  for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- exam_answers
alter table public.exam_answers enable row level security;
drop policy if exists "exam_answers self" on public.exam_answers;
drop policy if exists "exam_answers admin" on public.exam_answers;

create policy "exam_answers self" on public.exam_answers
  for all to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.exam_sessions s
      where s.id = exam_answers.session_id and s.user_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.exam_sessions s
      where s.id = exam_answers.session_id and s.user_id = auth.uid()
    )
  );

-- violations
alter table public.violations enable row level security;
drop policy if exists "violations insert self" on public.violations;
drop policy if exists "violations read self" on public.violations;
drop policy if exists "violations admin update" on public.violations;

create policy "violations insert self" on public.violations
  for insert to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.exam_sessions s
      where s.id = violations.session_id and s.user_id = auth.uid()
    )
  );
create policy "violations read self" on public.violations
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.exam_sessions s
      where s.id = violations.session_id and s.user_id = auth.uid()
    )
  );
create policy "violations admin update" on public.violations
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- scores
alter table public.scores enable row level security;
drop policy if exists "scores self" on public.scores;
drop policy if exists "scores self insert" on public.scores;
drop policy if exists "scores admin" on public.scores;
drop policy if exists "Users view own scores" on public.scores;
drop policy if exists "Users insert own scores" on public.scores;
drop policy if exists "Admins view all scores" on public.scores;

create policy "scores self" on public.scores
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "scores self insert" on public.scores
  for insert to authenticated
  with check (user_id = auth.uid() or public.is_admin());
create policy "scores admin" on public.scores
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- payments
alter table public.payments enable row level security;
drop policy if exists "payments self" on public.payments;
drop policy if exists "payments self insert" on public.payments;
drop policy if exists "payments admin" on public.payments;

create policy "payments self" on public.payments
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "payments self insert" on public.payments
  for insert to authenticated
  with check (user_id = auth.uid());
create policy "payments admin" on public.payments
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- personal_notes
alter table public.personal_notes enable row level security;
drop policy if exists "personal_notes self" on public.personal_notes;

create policy "personal_notes self" on public.personal_notes
  for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- notes (shared)
alter table public.notes enable row level security;
drop policy if exists "notes read" on public.notes;
drop policy if exists "notes admin all" on public.notes;

create policy "notes read" on public.notes
  for select to authenticated
  using (true);
create policy "notes admin all" on public.notes
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- platform_settings
alter table public.platform_settings enable row level security;
drop policy if exists "ps read" on public.platform_settings;
drop policy if exists "ps admin all" on public.platform_settings;

create policy "ps read" on public.platform_settings
  for select to authenticated
  using (true);
create policy "ps admin all" on public.platform_settings
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- student_streaks
alter table public.student_streaks enable row level security;
drop policy if exists "ss self" on public.student_streaks;

create policy "ss self" on public.student_streaks
  for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- user_preferences
alter table public.user_preferences enable row level security;
drop policy if exists "up self" on public.user_preferences;

create policy "up self" on public.user_preferences
  for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- login_history
alter table public.login_history enable row level security;
drop policy if exists "lh self read" on public.login_history;

create policy "lh self read" on public.login_history
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- download_requests
alter table public.download_requests enable row level security;
drop policy if exists "dr self" on public.download_requests;

create policy "dr self" on public.download_requests
  for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- mfa_email_codes + verifications: service-role only (no policies)
alter table public.mfa_email_codes enable row level security;
alter table public.verifications enable row level security;
