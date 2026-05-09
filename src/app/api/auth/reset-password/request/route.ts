import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { sendEmail, emailTemplates } from "@/lib/email";

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // 1. Check if user exists
    let targetUser = null;
    try {
      const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
      if (listError) {
        console.error("listUsers error:", listError);
        // Network error - return user-friendly message
        return NextResponse.json({ 
          error: "Unable to process request. Please check your connection and try again.",
          retry: true 
        }, { status: 503 });
      }
      targetUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    } catch (networkError) {
      console.error("Network error in listUsers:", networkError);
      return NextResponse.json({ 
        error: "Unable to connect to authentication service. Please try again later.",
        retry: true 
      }, { status: 503 });
    }
    
    // Security: Don't leak if email exists, but we need to know so we don't send to non-users
    if (!targetUser) {
      // Return success even if user doesn't exist to prevent email enumeration
      return NextResponse.json({ success: true, message: "If an account exists, a code has been sent." });
    }

    // 2. Rate Limit (1 minute)
    const { data: lastVer } = await supabase
      .from("verifications")
      .select("created_at")
      .eq("identifier", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (lastVer && (Date.now() - new Date(lastVer.created_at).getTime() < 60000)) {
      return NextResponse.json({ error: "Please wait 60 seconds before requesting another code." }, { status: 429 });
    }

    // 3. Generate & Store
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60000);

    const { error: upsertError } = await supabase.from("verifications").upsert({
      identifier: email,
      code: generatedOtp,
      expires_at: expiresAt.toISOString(),
      attempts: 0,
      verified_at: null,
    }, { onConflict: 'identifier' });

    if (upsertError) throw upsertError;

    // 4. Send Email via Resend
    try {
      await sendEmail({
        to: email,
        subject: "Reset your password - Scientia Prep",
        html: emailTemplates.passwordReset(generatedOtp),
      });
    } catch (emailError) {
      console.error("Failed to send reset email:", emailError);
      return NextResponse.json({ 
        error: "Failed to send email. Please try again later.",
        retry: true 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Security code sent to your email." 
    });
  } catch (error: any) {
    console.error("Reset request error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
