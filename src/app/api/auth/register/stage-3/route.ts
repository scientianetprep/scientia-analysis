import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// Stage 3: WhatsApp (phone) verification — the final step before admin queue.
// After success the user's profile has whatsapp_number set and status='pending'.

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) return "+92" + cleaned.slice(1);
  if (cleaned.startsWith("3")) return "+92" + cleaned;
  if (cleaned.startsWith("92")) return "+" + cleaned;
  return "+" + cleaned;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, phone, otp, action } = body;

    if (!userId || !phone) {
      return NextResponse.json({ error: "userId and phone are required" }, { status: 400 });
    }

     // Verify the user exists
     const { data: authUser, error: getUserError } = await supabase.auth.admin.getUserById(userId);
     if (getUserError || !authUser?.user) {
       return NextResponse.json({ error: "User not found" }, { status: 404 });
     }

     // Check registration expiration (must be within 24h window)
     const { data: expProfile } = await supabase
       .from("profiles")
       .select("registration_stage, registration_expires_at")
       .eq("user_id", userId)
       .single();

     if (expProfile && expProfile.registration_stage < 4 && expProfile.registration_expires_at) {
       if (new Date() > new Date(expProfile.registration_expires_at)) {
         // Expired — purge and reject
         await supabase.auth.admin.deleteUser(userId);
         return NextResponse.json(
           { error: "expired", message: "Your registration session has expired. Please start fresh." },
           { status: 400 }
         );
       }
     }

    const formattedPhone = formatPhone(phone);

    // Pakistan number validation
    const phoneRegex = /^\+92[3][0-9]{9}$/;
    if (!phoneRegex.test(formattedPhone)) {
      return NextResponse.json(
        { error: "Please enter a valid Pakistan mobile number (03XXXXXXXXX)" },
        { status: 400 }
      );
    }

    // ── Action: Send OTP ──────────────────────────────────────────────────
    if (action === "send") {
      // Check this phone isn't already used by another user
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("whatsapp_number", formattedPhone)
        .neq("user_id", userId)
        .single();

      if (existingProfile) {
        return NextResponse.json(
          { error: "This WhatsApp number is already linked to another account" },
          { status: 400 }
        );
      }

      // Rate limit: 30 seconds
      const { data: lastVer } = await supabase
        .from("verifications")
        .select("created_at, verified_at")
        .eq("identifier", formattedPhone)
        .single();

      if (lastVer?.verified_at) {
        // Already verified for this user — allow moving forward
        return NextResponse.json({ success: true, status: "ALREADY_VERIFIED" });
      }

      if (
        lastVer &&
        Date.now() - new Date(lastVer.created_at).getTime() < 30_000
      ) {
        return NextResponse.json({ error: "Please wait 30 seconds before resending" }, { status: 429 });
      }

      // Generate & store OTP
      const generatedOtp = Math.floor(100_000 + Math.random() * 900_000).toString();
      const expiresAt = new Date(Date.now() + 5 * 60_000); // 5 min

       const { error: upsertError } = await supabase.from("verifications").upsert(
         {
           identifier: formattedPhone,
           code: generatedOtp,
           expires_at: expiresAt.toISOString(),
           attempts: 0,
           verified_at: null,
           stage: 3,
         },
         { onConflict: "identifier" }
       );
      if (upsertError) throw upsertError;

      // Send via Fonnte (WhatsApp)
      const smsResponse = await fetch(
        `${env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-sms-fonnte`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            user: { phone: formattedPhone },
            sms: { otp: generatedOtp },
          }),
        }
      );

      if (!smsResponse.ok) {
        console.error("SMS send failed:", await smsResponse.text());
        return NextResponse.json(
          { error: "Failed to send WhatsApp OTP. Please try again." },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, message: "OTP sent to your WhatsApp" });
    }

    // ── Action: Verify OTP ───────────────────────────────────────────────
    if (action === "verify") {
      if (!otp) {
        return NextResponse.json({ error: "OTP required" }, { status: 400 });
      }

      const { data: verification, error: fetchError } = await supabase
        .from("verifications")
        .select("id, code, expires_at, attempts")
        .eq("identifier", formattedPhone)
        .single();

      if (fetchError || !verification) {
        return NextResponse.json({ error: "No pending verification for this number" }, { status: 400 });
      }
      if (new Date(verification.expires_at) < new Date()) {
        return NextResponse.json({ error: "OTP expired. Please request a new one." }, { status: 400 });
      }
      if (verification.attempts >= 5) {
        return NextResponse.json({ error: "Too many attempts. Please request a new OTP." }, { status: 400 });
      }

      if (verification.code !== otp.toString().trim()) {
        await supabase
          .from("verifications")
          .update({ attempts: verification.attempts + 1 })
          .eq("id", verification.id);
        return NextResponse.json({ error: "Invalid OTP" }, { status: 400 });
      }

      // Mark verified
      await supabase
        .from("verifications")
        .update({ verified_at: new Date().toISOString() })
        .eq("id", verification.id);

      // Update profile: set whatsapp_number + phone, finalize State Machine
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          whatsapp_number: formattedPhone,
          phone: formattedPhone,
          status: "pending",
          registration_stage: 4,
          registration_expires_at: null, // Clear expiration - permanent
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (updateError) throw updateError;

      // Send Welcome Email (email comes from auth.users, not profiles)
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", userId)
        .single();
      const userEmail = authUser.user.email;
      if (profile && userEmail) {
        await fetch(`${env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/mail`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "welcome",
            to: userEmail,
            data: { name: profile.full_name }
          })
        }).catch(e => console.error("Welcome email failed:", e));
      }

      // Cleanup the verification row
      await supabase.from("verifications").delete().eq("identifier", formattedPhone);

      return NextResponse.json({
        success: true,
        message: "WhatsApp verified. Your application is pending admin approval.",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("Stage-3 error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}