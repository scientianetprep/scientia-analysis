import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { sendEmail, emailTemplates } from "@/lib/email";

// Stage 1: Email verification + account creation
// (Google OAuth is handled separately via /auth/callback)

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, otp, password, action } = body;

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

     // ── Action: Send email verification OTP ──────────────────────────────
     if (action === "send-code") {
       // Check if email is already in use
       const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
       if (listError) throw listError;

       const existingUser = users.find(
         (u) => u.email?.toLowerCase() === email.toLowerCase()
       );

       if (existingUser) {
         // Check if user has an expired registration profile
         const { data: existingProfile } = await supabase
           .from("profiles")
           .select("registration_stage, registration_expires_at")
           .eq("user_id", existingUser.id)
           .single();

         const isExpired =
           existingProfile &&
           existingProfile.registration_stage < 4 &&
           existingProfile.registration_expires_at &&
           new Date() > new Date(existingProfile.registration_expires_at);

         if (isExpired) {
           // Clean up expired account to allow re-registration
           await supabase.auth.admin.deleteUser(existingUser.id);
         } else {
           // Existing active registration — prompt to login
           return NextResponse.json(
             {
               error: "email_exists",
               message: "This email is already registered.",
               loginUrl: `/login?email=${encodeURIComponent(email)}`,
             },
             { status: 400 }
           );
         }
       }

      // Rate limit: 60 seconds between sends
      const { data: lastVer } = await supabase
        .from("verifications")
        .select("created_at")
        .eq("identifier", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (
        lastVer &&
        Date.now() - new Date(lastVer.created_at).getTime() < 60_000
      ) {
        return NextResponse.json({ error: "Please wait 60 seconds before resending" }, { status: 429 });
      }

      // Generate & store OTP
      const generatedOtp = Math.floor(100_000 + Math.random() * 900_000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60_000); // 10 min

       const { error: upsertError } = await supabase.from("verifications").upsert(
         {
           identifier: email,
           code: generatedOtp,
           expires_at: expiresAt.toISOString(),
           attempts: 0,
           verified_at: null,
           stage: 1,
         },
         { onConflict: "identifier" }
       );
      if (upsertError) throw upsertError;

      // Send email
      await sendEmail({
        to: email,
        subject: "Verify your email – Scientia Prep",
        html: emailTemplates.registrationOtp(generatedOtp),
        code: generatedOtp,
      });

      return NextResponse.json({ success: true, message: "Verification code sent to your email." });
    }

    // ── Action: Verify OTP + create account ──────────────────────────────
    if (action === "verify-and-create") {
      if (!otp || !password) {
        return NextResponse.json({ error: "OTP and password required" }, { status: 400 });
      }

      // 1. Validate OTP
      const { data: verification, error: fetchError } = await supabase
        .from("verifications")
        .select("id, code, expires_at, attempts")
        .eq("identifier", email)
        .single();

      if (fetchError || !verification) {
        return NextResponse.json({ error: "No pending verification for this email" }, { status: 400 });
      }
      if (new Date(verification.expires_at) < new Date()) {
        return NextResponse.json({ error: "Code expired. Please request a new one." }, { status: 400 });
      }
      if (verification.attempts >= 5) {
        return NextResponse.json({ error: "Too many attempts. Request a new code." }, { status: 400 });
      }

      const cleanOtp = otp.toString().trim();
      if (verification.code !== cleanOtp) {
        await supabase
          .from("verifications")
          .update({ attempts: verification.attempts + 1 })
          .eq("id", verification.id);
        return NextResponse.json({ error: "Invalid code" }, { status: 400 });
      }

      // 2. Validate password strength
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
      if (!passwordRegex.test(password)) {
        return NextResponse.json(
          { error: "Password must be at least 8 characters with an uppercase letter and a number" },
          { status: 400 }
        );
      }

      // 3. Create Supabase auth user (email confirmed)
      const { data: userData, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createError) throw createError;

      // 4. Create minimal profile with State Machine fields
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      const { error: profileError } = await supabase.from("profiles").insert({
        user_id: userData.user.id,
        email,
        role: "student",
        status: "pending",
        mfa_enrolled: false,
        mfa_verified: false,
        registration_stage: 1,
        registration_started_at: new Date().toISOString(),
        registration_expires_at: expiresAt.toISOString(),
        email_verified_at: new Date().toISOString(),
      });
      if (profileError) throw profileError;

      // 5. Cleanup verification row
      await supabase.from("verifications").delete().eq("identifier", email);

      return NextResponse.json({
        success: true,
        userId: userData.user.id,
        message: "Account created — please complete your profile.",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("Stage-1 error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}