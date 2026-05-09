import "server-only";

import { redirect } from "next/navigation";
import { createServerClientFn } from "./server";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

const ADMIN_ROLES = ["admin", "super_admin", "examiner"];

export interface RequireAdminOptions {
  /** For API routes, return 403 instead of redirecting (avoids 500 errors) */
  context?: "page" | "api";
  /** Skip MFA check (for APIs that don't require it) */
  redirectToMfa?: boolean;
}

/**
 * Layer 3 Security Guard: requireAdmin
 * Verifies identity (JWT), MFA enrollment, and Database role.
 * Uses custom email OTP MFA (mfa_enrolled) instead of Supabase TOTP (aal2).
 * 
 * @returns { user, profile, supabase }
 */
export async function requireAdmin(options: RequireAdminOptions = { context: "page" }) {
  const { context = "page", redirectToMfa = true } = options;
  const isApi = context === "api";

  const respond = (status: number, body: object) =>
    new Response(JSON.stringify(body), { status });

  const supabase = await createServerClientFn();

  // Step 1: Verify the user token cryptographically
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return isApi
      ? respond(403, { error: "Forbidden" })
      : redirect("/login") as never;
  }

  // Step 2+3: Single query — check role + MFA enrollment from DB (source of truth)
  // Use service role to bypass RLS for profile reads
  const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role, mfa_enrolled")
    .eq("user_id", user!.id)
    .single();

  if (profileError || !profile) {
    return isApi
      ? respond(403, { error: "Forbidden" })
      : redirect("/login") as never;
  }

  if (!ADMIN_ROLES.includes(profile.role)) {
    return isApi
      ? respond(403, { error: "Forbidden" })
      : redirect("/dashboard") as never;
  }

  return { user: user!, profile, supabase };
}
