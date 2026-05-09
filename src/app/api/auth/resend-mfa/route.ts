import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { createServerClientFn } from "@/lib/supabase/server";
import { env } from "@/lib/env";

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin") || request.headers.get("referer");
    const allowedOrigin = env.NEXT_PUBLIC_SITE_URL;
    // Allow localhost (dev) and the configured site URL (production)
    const isAllowed = origin?.startsWith(allowedOrigin) || origin?.startsWith("http://localhost");
    if (!isAllowed) {
      return NextResponse.json({ error: "Invalid request" }, { status: 403 });
    }

    // Use server client - gets user from session cookie
    const supabase = await createServerClientFn();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user_id = user.id;

    // Get user's phone from profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("whatsapp_number")
      .eq("user_id", user_id)
      .single();

    if (profileError || !profile?.whatsapp_number) {
      return NextResponse.json({ error: "No phone on file" }, { status: 400 });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Store OTP
    await supabase
      .from("profiles")
      .update({ mfa_otp: otp, mfa_otp_expires: expires })
      .eq("user_id", user_id);

    // Send OTP via Fonnte
    const functionUrl = `${env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-sms-fonnte`;

    await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        user: { phone: profile.whatsapp_number },
        sms: { otp, template: "Your login code is: {{otp}}" },
      }),
    });

    return NextResponse.json({ success: true, message: "OTP sent" });
  } catch (error) {
    console.error("Resend MFA error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}