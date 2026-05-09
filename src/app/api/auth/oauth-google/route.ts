import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { phone, mode } = body as { phone?: string; mode?: "register" | "login" };

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
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Ignore: called from Server Component context
            }
          },
        },
      }
    );

    // Build the redirect_to URL — simplified to avoid whitelist mismatches
    const origin = request.headers.get("origin") || "http://localhost:3000";
    const redirectTo = `${origin}/auth/callback`;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        scopes: "email profile",
        queryParams: {
          // Always show the Google account picker
          prompt: "select_account",
          access_type: "offline",
        },
      },
    });

    if (error || !data?.url) {
      console.error("OAuth initiation error:", error);
      return NextResponse.json(
        { error: error?.message || "Failed to initiate OAuth" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: data.url });
  } catch (err: unknown) {
    console.error("OAuth-google route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}