# RBAC via Custom JWT Claims Design

## Overview
Implement a high-performance Role-Based Access Control (RBAC) system in Supabase by injecting user roles and statuses directly into the JWT. This allows Row Level Security (RLS) to verify permissions without redundant database queries.

## Architecture
- **Auth Hook**: Supabase Custom Access Token (JWT) Hook triggering `public.custom_claims(event jsonb)`.
- **Claims Namespace**: `custom_claims` inside the JWT payload.
- **Data Source**: `public.profiles` table (`role`, `status`, `mfa_enrolled`).

## Claims Structure
```json
{
  "custom_claims": {
    "role": "admin | student | teacher",
    "status": "active | pending | suspended",
    "mfa_enrolled": boolean
  }
}
```

## Security Requirements
1. **Admins**: Bypass ownership checks for all `public` tables (except sensitive system tables).
2. **Students**: Can only access their own data when `status = 'active'`.
3. **Pending Users**: Restricted to reading their own basic profile only (no academic info).
4. **MFA Enforcement**: (Future) Policies can check `mfa_enrolled` for high-sensitivity operations.

## RLS Strategy
Policies will follow this pattern:
`((auth.jwt() -> 'custom_claims' ->> 'role') = 'admin')`

## Verification
- SQL Query: `SELECT auth.jwt() -> 'custom_claims';` executed as a specific user to verify injection.
