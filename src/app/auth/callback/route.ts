import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const oauthError = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");
  const mode = requestUrl.searchParams.get("mode") as "register" | "login" | null;

  const origin = requestUrl.origin;

  // ── Handle OAuth errors from Google ──────────────────────────────────────
  if (oauthError) {
    console.error("OAuth error from Google:", oauthError, errorDescription);
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorDescription || oauthError)}`, origin)
    );
  }

  if (!code) {
    console.error("No code in OAuth callback");
    return NextResponse.redirect(new URL("/login?error=auth_failed", origin));
  }

  // ── Exchange code → session (sets auth cookies via SSR client) ────────────
  const cookieStore = await cookies();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              cookieStore.set(name, value, options);
            } catch (err) {
              console.error("Cookie set error:", err);
            }
          });
        },
      },
    }
  );

  const { data: sessionData, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !sessionData?.user) {
    console.error("Code exchange error:", exchangeError);
    return NextResponse.redirect(new URL("/login?error=auth_failed", origin));
  }

  const userId = sessionData.user.id;

  // ── Use admin client for DB operations (bypasses RLS) ────────────────────
  const admin = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  );

  // ── Fetch existing profile with State Machine fields ──────────────────────
  const { data: profile } = await admin
    .from("profiles")
    .select("user_id, username, cnic, status, whatsapp_number, registration_stage, registration_expires_at, role")
    .eq("user_id", userId)
    .single();

  // ── Smart Redirection Logic ──────────────────────────────────────────────

  // 1. New User (No Profile) - create with State Machine fields
  if (!profile) {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const { error: insertError } = await admin.from("profiles").insert({
      user_id: userId,
      email: sessionData.user.email,
      role: "student",
      status: "pending",
      mfa_enrolled: false,
      mfa_verified: false,
      registration_stage: 1,
      registration_started_at: new Date().toISOString(),
      registration_expires_at: expiresAt.toISOString(),
      email_verified_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error("Profile creation error:", insertError);
      return NextResponse.redirect(new URL("/register?error=profile_create_failed", origin));
    }

    return NextResponse.redirect(
      new URL(`/register?resume=stage-2&uid=${userId}&provider=google`, origin)
    );
  }

  // 2. Check expiration for incomplete registrations
  if (profile.registration_stage < 4) {
    const { data: profileWithExpiry } = await admin
      .from("profiles")
      .select("registration_expires_at")
      .eq("user_id", userId)
      .single();

    if (profileWithExpiry?.registration_expires_at) {
      const expiresAt = new Date(profileWithExpiry.registration_expires_at);
      if (new Date() > expiresAt) {
        // Expired - delete user (cascade removes profile)
        await admin.auth.admin.deleteUser(userId);
        return NextResponse.redirect(new URL("/register?error=expired", origin));
      }
    }
  }

  // 3. Incomplete Profile (Missing basic info) - check stage
  if (!profile.username || !profile.cnic) {
    return NextResponse.redirect(
      new URL(`/register?resume=stage-2&uid=${userId}&provider=google`, origin)
    );
  }

  // 4. Incomplete Verification (Missing WhatsApp) - check stage
  if (!profile.whatsapp_number) {
    return NextResponse.redirect(
      new URL(`/register?resume=stage-3&uid=${userId}`, origin)
    );
  }

  // 5. Complete Profile - Check Approval Status
  if (profile.status === "pending" || profile.status === "payment_pending") {
    return NextResponse.redirect(new URL("/pending", origin));
  }

  if (profile.status === "suspended" || profile.status === "expired") {
    return NextResponse.redirect(new URL("/login?suspended=true", origin));
  }

  if (profile.status === "rejected") {
    return NextResponse.redirect(new URL("/login?rejected=true", origin));
  }

  // 6. Approved — Redirect based on role
  const ADMIN_ROLES = ["admin", "super_admin", "examiner"];
  if (ADMIN_ROLES.includes(profile?.role)) {
    return NextResponse.redirect(new URL("/admin", origin));
  }
  return NextResponse.redirect(new URL("/dashboard", origin));
}

