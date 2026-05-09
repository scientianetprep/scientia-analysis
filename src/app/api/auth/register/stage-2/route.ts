import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { z } from "zod";

// Stage 2: Profile info (name, username, CNIC, city)
// userId comes from Stage 1 (email path) or the OAuth callback (Google path)

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

const profileSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  full_name: z.string().min(2, "Full name is too short"),
  username: z
    .string()
    .min(4, "Username must be at least 4 characters")
    .max(16, "Username must be at most 16 characters")
    .regex(/^[a-z0-9_]+$/, "Username: lowercase letters, numbers, and underscores only"),
  cnic: z.string().regex(/^\d{5}-\d{7}-\d{1}$/, "Invalid CNIC format (12345-1234567-1)"),
  city: z.string().min(2, "City name is too short"),
  // Password is only ever sent by the Google OAuth branch of the register
  // UI. The email branch leaves it undefined. Normalize "" → undefined first,
  // then require min(8) if still present, so an empty string from the form
  // no longer trips Zod with the confusing "Too small: expected >=8" error.
  password: z
    .union([z.string().min(8, "Password must be at least 8 characters"), z.literal("")])
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = profileSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { userId, full_name, username, cnic, city, password } = result.data;

     // 1. Verify the auth user actually exists (prevents spoofed userId attacks)
     const { data: authUser, error: getUserError } = await supabase.auth.admin.getUserById(userId);
     if (getUserError || !authUser?.user) {
       return NextResponse.json({ error: "User not found" }, { status: 404 });
     }

     // 2. Check registration expiration (incomplete registrations must complete within 24h)
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

    // 2. If password provided (Google flow), update auth user
    if (password) {
      const { error: updateByIdError } = await supabase.auth.admin.updateUserById(userId, {
        password: password,
      });
      if (updateByIdError) throw updateByIdError;
    }

    // 3. Check username uniqueness (excluding current user in case of retry)
    const { data: existingUsername } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("username", username)
      .neq("user_id", userId)
      .single();

    if (existingUsername) {
      return NextResponse.json({ error: "Username already taken" }, { status: 400 });
    }

    // 3. Check CNIC uniqueness (excluding current user in case of retry)
    const { data: existingCnic } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("cnic", cnic)
      .neq("user_id", userId)
      .single();

    if (existingCnic) {
      return NextResponse.json({ error: "CNIC already registered" }, { status: 400 });
    }

    // 4. Upsert profile with State Machine stage (handles both first-time save and retries)
    const { error: upsertError } = await supabase.from("profiles").upsert(
      {
        user_id: userId,
        email: authUser.user.email,
        full_name,
        username,
        cnic,
        city,
        role: "student",
        status: "pending",
        mfa_enrolled: false,
        mfa_verified: false,
        registration_stage: 2,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (upsertError) throw upsertError;

    return NextResponse.json({
      success: true,
      message: "Profile saved — please verify your WhatsApp number.",
    });
  } catch (err: any) {
    console.error("Stage-2 error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
