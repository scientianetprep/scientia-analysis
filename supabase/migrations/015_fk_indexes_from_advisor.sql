-- Phase 1 migration 5/5 — covering indexes on FK columns flagged by the
-- Supabase performance advisor. Improves join performance on admin
-- queries and RLS policy subqueries.

create index if not exists admin_audit_log_admin_id_idx
  on public.admin_audit_log (admin_id);
create index if not exists admin_audit_log_target_user_id_idx
  on public.admin_audit_log (target_user_id);

create index if not exists admin_notifications_target_user_id_idx
  on public.admin_notifications (target_user_id);
create index if not exists admin_notifications_created_by_idx
  on public.admin_notifications (created_by);

create index if not exists course_access_grants_user_id_idx
  on public.course_access_grants (user_id);
create index if not exists course_access_grants_course_id_idx
  on public.course_access_grants (course_id);
create index if not exists course_access_grants_granted_by_idx
  on public.course_access_grants (granted_by);

create index if not exists courses_category_id_idx
  on public.courses (category_id);

create index if not exists exam_answers_session_id_idx
  on public.exam_answers (session_id);
create index if not exists exam_answers_question_id_idx
  on public.exam_answers (question_id);

create index if not exists exam_sessions_user_id_idx
  on public.exam_sessions (user_id);
create index if not exists exam_sessions_test_id_idx
  on public.exam_sessions (test_id);
create index if not exists exam_sessions_score_id_idx
  on public.exam_sessions (score_id);

create index if not exists feedback_user_id_idx
  on public.feedback (user_id);

create index if not exists lessons_course_id_idx
  on public.lessons (course_id);
create index if not exists lessons_section_id_idx
  on public.lessons (section_id);

create index if not exists lesson_sections_course_id_idx
  on public.lesson_sections (course_id);

create index if not exists lesson_resources_lesson_id_idx
  on public.lesson_resources (lesson_id);

create index if not exists lesson_completions_user_id_idx
  on public.lesson_completions (user_id);
create index if not exists lesson_completions_lesson_id_idx
  on public.lesson_completions (lesson_id);

create index if not exists login_history_user_id_idx
  on public.login_history (user_id);

create index if not exists media_assets_uploader_id_idx
  on public.media_assets (uploader_id);
create index if not exists media_assets_course_id_idx
  on public.media_assets (course_id);
create index if not exists media_assets_lesson_id_idx
  on public.media_assets (lesson_id);

create index if not exists notification_acknowledgements_user_id_idx
  on public.notification_acknowledgements (user_id);
create index if not exists notification_acknowledgements_notification_id_idx
  on public.notification_acknowledgements (notification_id);

create index if not exists payments_user_id_idx
  on public.payments (user_id);
create index if not exists payments_marked_paid_by_idx
  on public.payments (marked_paid_by);

create index if not exists personal_notes_user_id_idx
  on public.personal_notes (user_id);
create index if not exists personal_notes_lesson_id_idx
  on public.personal_notes (lesson_id);

create index if not exists questions_created_by_idx
  on public.questions (created_by);

create index if not exists scores_user_id_idx
  on public.scores (user_id);
create index if not exists scores_test_id_idx
  on public.scores (test_id);

create index if not exists tests_created_by_idx
  on public.tests (created_by);

create index if not exists violations_session_id_idx
  on public.violations (session_id);

create index if not exists download_requests_user_id_idx
  on public.download_requests (user_id);
create index if not exists download_requests_lesson_id_idx
  on public.download_requests (lesson_id);

create index if not exists account_deletion_requests_user_id_idx
  on public.account_deletion_requests (user_id);
create index if not exists account_deletion_requests_reviewed_by_idx
  on public.account_deletion_requests (reviewed_by);

create index if not exists academic_info_user_id_idx
  on public.academic_info (user_id);

create index if not exists profiles_role_status_idx
  on public.profiles (role, status);
create index if not exists profiles_user_id_unique_idx
  on public.profiles (user_id);
