import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { createServerClientFn } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { z } from "zod";

const verifySchema = z.object({
  otp: z.string().length(6),
});

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin") || request.headers.get("referer");
    const allowedOrigin = env.NEXT_PUBLIC_SITE_URL;
    // Allow localhost (dev) and the configured site URL (production)
    const isAllowed = origin?.startsWith(allowedOrigin) || origin?.startsWith("http://localhost");
    if (!isAllowed) {
      return NextResponse.json({ error: "Invalid request" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = verifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "6-digit OTP required" }, { status: 400 });
    }

    const { otp } = parsed.data;

    // Use server client - gets user from session cookie
    const supabase = await createServerClientFn();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user_id = user.id;

    // Verify OTP
    const { data: otpMatch, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user_id)
      .eq("mfa_otp", otp)
      .gte("mfa_otp_expires", new Date().toISOString())
      .single();

    if (!otpMatch) {
      return NextResponse.json({ error: "Invalid or expired OTP" }, { status: 400 });
    }

    // Mark MFA as verified
    await supabase
      .from("profiles")
      .update({ mfa_enrolled: true, mfa_otp: null, mfa_otp_expires: null })
      .eq("user_id", user_id);

    return NextResponse.json({ success: true, verified: true });
  } catch (error) {
    console.error("Verify MFA error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}