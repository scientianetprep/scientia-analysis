# Scientia Prep LMS - Developer Documentation

Scientia Prep is an advanced, high-security Learning Management System (LMS) and e-Testing platform designed to provide courses, lessons, and highly secure, proctored online examinations.

This document serves as the comprehensive internal developer guide, outlining the application's architecture, database schema, exact API topography, and core feature sets.

---

## 🏗 Architecture & Tech Stack

- **Framework**: Next.js (App Router) v14/15. The architecture strictly segregates Client Boundaries (`"use client"`) from Server-Side Rendering and Server Actions.
- **Languages**: TypeScript, React 19.
- **Styling**: Tailwind CSS v4, Framer Motion (for animations), Lucide React (for icons).
- **Backend & Database**: Supabase (PostgreSQL 17).
- **Component Primitives**: shadcn/ui components (`MarkdownEditor`, `Button`, `Skeleton`, etc.).
- **Content Rendering**: 
  - `hls.js` securely handles encrypted streaming video delivery inside `LiteVideoPlayer.tsx`, pulling from Cloudflare R2 (`NEXT_PUBLIC_CLOUDFLARE_R2_BUCKET_NAME`).
  - `react-markdown`, `remark-math`, `rehype-katex` power the `LessonRenderer.tsx` and `QuestionForm.tsx` to display standard TeX/Math algorithms natively.
- **State Management & Validation**: 
  - Zustand and React Query manage asynchronous server states.
  - Zod parsing (`src/lib/schemas/*` including `exam-session.ts`, `question.ts`, `test.ts`, `violation.ts`) ensures the high-throughput testing engine validates payloads instantly.

---

## 🔒 Security Architecture (Four-Layer Model)

1. **Ghost Mode (Middleware Proxy)**: The `proxy.ts` middleware acts as a Layer-7 shield. Admin and Proctor routes `/(admin)` are completely obfuscated, throwing **404 Rewrites** instead of 403s for unauthorized users to hide the administrative attack surface.
2. **Server-Side Gate**: App layout gates enforce cryptographic identity checks, requiring multi-factor authentication (AAL2 verification) and strict database role checks. 
3. **API Hardening & Edge Deployments**: 
  - Strict API route handling utilizes `src/lib/supabase/require-admin.ts` to block mutations at the boundary layer.
  - A standalone Deno Edge function `supabase/functions/send-sms-fonnte` is isolated completely to handle transactional OTP/MFA dispatch sequences safely.
4. **Row-Level Security (RLS)**: Deeply integrated PostgreSQL RLS policies evaluate users dynamically, utilizing Custom Access Token hooks that inject RBAC claims (`role`, `status`, `mfa_enrolled`) directly into the JWT for ultra-fast authorization that bypasses heavy DB lookups.

---

## 🗄️ Database Schema & Data Models

The data layer spans two primary schemas: `auth` (Supabase managed) and `public` (App managed).

### DB Procedural Logic & Triggers
The system utilizes advanced PostgreSQL procedural logic (PL/pgSQL) to handle state:
*   **`sync_profile_to_auth()` (Trigger)**: Runs `AFTER INSERT/UPDATE` on `public.profiles`. Synchronizes App-level profile data back to the core Auth system.
*   **`custom_claims() -> jsonb` (Supabase Hook)**: Fires during JWT minting to inject `role`, `status`, and `mfa_enrolled` directly into the stateless user token.
*   **`increment_violation_count()`**: Atomic DB-level function to safely increment cheat flags during a live exam session natively.
*   **`rls_auto_enable()` (Event Trigger)**: Guarantees that any new table created *must* have RLS enabled by default.

### 1. Identity & Access Management
*   **`auth.users`**: Core user authentication table natively hooked into SSO and MFA identity networks.
*   **`profiles`**: Extended user table. Tracks `registration_stage` (1-4), MFA statuses, and exact academic locks alongside `cnic`, `role` (student, admin, super_admin, examiner, proctor), and `status`.
*   **`login_history`**: Security audit table tracking `ip_address`, `user_agent`, login methods.
*   **`account_deletion_requests`**: Administrative pipeline for offboarding.

### 2. Multi-Factor Authentication (MFA)
*   **`auth.mfa_factors` \& `auth.mfa_challenges`**: Deeply integrated native tracking of WebAuthn sessions and TOTP OTP validation.
*   **`mfa_email_codes`**: Custom implementation to handle Email-based OTP backups natively.

### 3. Application Entities: Curriculum & Exam Engine
*   **`lessons` \& `courses`**: Central learning nodes tracking sequence data, course metadata, and content types (`pdf`, `video`, `markdown`, `latex`).  
*   **`questions`**: Advanced multiple-choice data pooling. Carries `topic`, `chapter`, `bloom_level` (remember -> create), `difficulty`, and `marks`. Tracks analytics natively (`usage_count`, `correct_rate`, `skip_rate`).
*   **`tests`**: Exam blueprints configuring `time_limit`, `negative_marking`, `shuffle_questions/options`, and `pass_percentage`.
*   **`exam_sessions`**: The live tracker. Maps `status` (in_progress, submitted, etc) and tracks exact `time_remaining_s`. Interacts with `/api/exam/session`.
*   **`exam_answers`**: Receives high-frequency REST updates. Includes an `is_flagged` boolean for user reviews.
*   **`violations`**: Array log of `violation_type` (`tab_switch`, `focus_loss`, `copy_attempt`, `fullscreen_exit`, `suspicious_activity`) tied exactly to a live `session_id`.

---

## ⚖️ RLS Policy Matrix (Key Expressions)

Policies are specifically designed to require zero DB lookups during evaluation.

*   `Students can view published courses`: `(is_active_student() AND (is_published = true)) OR is_admin()`
*   `Candidates read approved questions`: `(status = 'approved'::text) OR ((auth.jwt() ->> 'role'::text) = ANY (ARRAY['admin', 'super_admin', 'examiner']))`
*   `Candidates insert own violations`: `(session_id IN (SELECT exam_sessions.id FROM exam_sessions WHERE (exam_sessions.user_id = auth.uid())))`
*   `service_insert_audit_log`: `(auth.role() = 'service_role'::text)` -> Enforces that Audit Logs can *only* be written by the protected Server execution layer.
*   `Admins can update all profiles`: `(((auth.jwt() -> 'custom_claims'::text) ->> 'role'::text) = 'admin'::text)` -> Implicit evaluation of the custom JWT claim hook.

---

## ⚡ Active API Topography

*   **Server Actions**: Found precisely isolated in `src/app/actions/user-preferences.ts`.
*   **Admin APIs** (`/api/admin/*`): Segmented by `courses`, `email`, `feedback`, `lessons`, `notifications`, `proctor`, `questions`, `settings`, `tests`, `users`.
*   **Exam Engine APIs** (`/api/exam/*`): High-speed, polling-ready endpoints -> `answer`, `session`, `submit`, `transcript`, `violation`.

---

## 💻 Environment Variables Guide

Duplicate `.env.example` into `.env.local` to securely boot the ecosystem:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...       # Required for Ghost Mode logic
SUPABASE_JWT_SECRET=...             # For custom cookie signing

# Media Storage (Cloudflare R2)
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_R2_ACCESS_KEY_ID=...
CLOUDFLARE_R2_SECRET_ACCESS_KEY=...
CLOUDFLARE_R2_BUCKET_NAME=academy-assets

# Payments & Verification
SAFEPAY_API_KEY=...
TWILIO_ACCOUNT_SID=...
RESEND_API_KEY=...                  

# Realtime / Chat Features
STREAM_SECRET_KEY=...
NEXT_PUBLIC_STREAM_API_KEY=...
```

## 🛠 Active Scripts
- `npm run dev`: Boots Next.js dev server.
- `npm run build`: Compiles for strict type-checking and production artifacts.
- `npm run lint`: Runs ESLint configurations.