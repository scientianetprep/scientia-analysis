import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request: NextRequest) {
  try {
    const { email, otp, password } = await request.json();

    if (!email || !otp || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Verify OTP
    const { data: verification, error: fetchError } = await supabase
      .from("verifications")
      .select("id, identifier, code, expires_at, attempts")
      .eq("identifier", email)
      .single();

    if (fetchError || !verification) return NextResponse.json({ error: "No pending reset request" }, { status: 400 });
    if (new Date(verification.expires_at) < new Date()) return NextResponse.json({ error: "Code expired" }, { status: 400 });
    if (verification.attempts >= 5) return NextResponse.json({ error: "Too many attempts" }, { status: 400 });

    if (verification.code !== otp) {
      await supabase.from("verifications").update({ attempts: verification.attempts + 1 }).eq("id", verification.id);
      return NextResponse.json({ error: "Invalid security code" }, { status: 400 });
    }

    // 2. Validate Password
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
      return NextResponse.json({ error: "Password must be min 8 chars, with uppercase and number" }, { status: 400 });
    }

    // 3. Find User
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;
    
    const targetUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 4. Update Password
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      targetUser.id,
      { password: password }
    );

    if (updateError) throw updateError;

    // 5. Cleanup
    await supabase.from("verifications").delete().eq("id", verification.id);

    return NextResponse.json({ 
      success: true, 
      message: "Password updated successfully. Please login." 
    });
  } catch (error: any) {
    console.error("Reset confirm error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
