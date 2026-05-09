# RBAC Claims Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize custom claims under the `custom_claims` key and update RLS policies for `profiles` and `academic_info`.

**Architecture:** Update Postgres function and RLS policies using Supabase MCP.

**Tech Stack:** Supabase (Postgres, RLS, Auth Hooks)

---

### Task 1: Update Custom Claims Function

**Files:**
- Modify: `public.custom_claims` (Postgres Function)

- [ ] **Step 1: Update function to use 'custom_claims' key**
```sql
CREATE OR REPLACE FUNCTION public.custom_claims(event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  claims jsonb;
  user_id uuid;
BEGIN
  user_id := (event->>'user_id')::uuid;

  SELECT jsonb_build_object(
    'role', p.role,
    'status', p.status,
    'mfa_enrolled', p.mfa_enrolled
  ) INTO claims
  FROM public.profiles p
  WHERE p.user_id = user_id;

  RETURN jsonb_build_object(
    'custom_claims', claims
  );
END;
$function$;
```

- [ ] **Step 2: Commit changes to database**
Run via `mcp_supabase_apply_migration`.

### Task 2: Update RLS Policies for Profiles

**Files:**
- Modify: `public.profiles` RLS Policies

- [ ] **Step 1: Update Admin Read/Update policies**
```sql
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles" ON public.profiles
FOR SELECT TO authenticated
USING ((auth.jwt() -> 'custom_claims' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" ON public.profiles
FOR UPDATE TO authenticated
USING ((auth.jwt() -> 'custom_claims' ->> 'role') = 'admin');
```

- [ ] **Step 2: Update User Update policy to include status check**
Allow both 'active' and 'pending' users to update their own profile (for registration).
```sql
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = user_id AND (auth.jwt() -> 'custom_claims' ->> 'status') IN ('active', 'pending'));
```

### Task 3: Update RLS Policies for Academic Info

**Files:**
- Modify: `public.academic_info` RLS Policies

- [ ] **Step 1: Update Admin policies**
```sql
DROP POLICY IF EXISTS "Admins can read all academic info" ON public.academic_info;
CREATE POLICY "Admins can read all academic info" ON public.academic_info
FOR SELECT TO authenticated
USING ((auth.jwt() -> 'custom_claims' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admins can update all academic info" ON public.academic_info;
CREATE POLICY "Admins can update all academic info" ON public.academic_info
FOR UPDATE TO authenticated
USING ((auth.jwt() -> 'custom_claims' ->> 'role') = 'admin');
```

- [ ] **Step 2: Update User Insert/Update/Select policies**
```sql
DROP POLICY IF EXISTS "Users can read own academic info" ON public.academic_info;
CREATE POLICY "Users can read own academic info" ON public.academic_info
FOR SELECT TO authenticated
USING (auth.uid() = user_id AND (auth.jwt() -> 'custom_claims' ->> 'status') IN ('active', 'pending'));

DROP POLICY IF EXISTS "Users can insert own academic info" ON public.academic_info;
CREATE POLICY "Users can insert own academic info" ON public.academic_info
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND (auth.jwt() -> 'custom_claims' ->> 'status') IN ('active', 'pending'));

DROP POLICY IF EXISTS "Users can update own academic info" ON public.academic_info;
CREATE POLICY "Users can update own academic info" ON public.academic_info
FOR UPDATE TO authenticated
USING (auth.uid() = user_id AND (auth.jwt() -> 'custom_claims' ->> 'status') IN ('active', 'pending'));
```

### Task 4: Verification

- [ ] **Step 1: Verify Claim Injection**
Run this query and check the output for the current user:
```sql
SELECT auth.jwt() -> 'custom_claims';
```
