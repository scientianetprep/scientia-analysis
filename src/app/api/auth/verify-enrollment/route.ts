import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { createServerClientFn } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { z } from "zod";

const verifySchema = z.object({
  code: z.string().min(1),
  method: z.enum(["totp", "whatsapp"]),
  factorId: z.string().optional(),
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
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    const { code, method, factorId } = parsed.data;

    // User client — gets the authenticated user from session
    const userClient = await createServerClientFn();
    const { data: { user } } = await userClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;

    // Admin client — service role for DB access (verifications table, etc.)
    const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    // ── TOTP verification ────────────────────────────────────────────────────
    if (method === "totp") {
      let { data: factors, error: listError } = await userClient.auth.mfa.listFactors();

      if (listError) {
        return NextResponse.json({ error: listError.message }, { status: 400 });
      }

      const allFactors = factors?.all || [];
      let factor = allFactors.find((f) => f.factor_type === "totp" && f.status === "unverified");

      if (factorId) {
        factor = allFactors.find((f) => f.id === factorId && f.factor_type === "totp");
      }

      if (!factor) {
        return NextResponse.json({ error: "No TOTP factor found. Please scan QR code first." }, { status: 400 });
      }

      // Create challenge
      const { data: challengeData, error: challengeError } = await userClient.auth.mfa.challenge({
        factorId: factor.id,
      });

      if (challengeError) {
        return NextResponse.json({ error: "Failed to create challenge: " + challengeError.message }, { status: 400 });
      }

      // Verify
      const { error: verifyError } = await userClient.auth.mfa.verify({
        factorId: factor.id,
        code,
        challengeId: challengeData.id,
      });

      if (verifyError) {
        return NextResponse.json({ error: verifyError.message }, { status: 400 });
      }

      // Mark MFA as enrolled in profile
      await userClient
        .from("profiles")
        .update({ mfa_enrolled: true })
        .eq("user_id", userId);

      return NextResponse.json({ success: true });
    }

    // ── WhatsApp verification ─────────────────────────────────────────────────
    if (method === "whatsapp") {
      // Get user's WhatsApp number using admin client
      const { data: profile } = await adminClient
        .from("profiles")
        .select("whatsapp_number")
        .eq("user_id", userId)
        .single();

      if (!profile?.whatsapp_number) {
        return NextResponse.json({ error: "No WhatsApp number on file" }, { status: 400 });
      }

      // Format phone to E.164
      const formatPhone = (p: string): string => {
        const cleaned = p.replace(/\D/g, "");
        if (cleaned.startsWith("0")) return "+92" + cleaned.slice(1);
        if (cleaned.startsWith("3")) return "+92" + cleaned;
        if (cleaned.startsWith("92")) return "+" + cleaned;
        return "+" + cleaned;
      };
      const formattedPhone = formatPhone(profile.whatsapp_number);

      // Look up pending verification using admin client (verifications table is service_role only)
      const { data: verification, error: fetchError } = await adminClient
        .from("verifications")
        .select("id, code, expires_at, attempts")
        .eq("identifier", formattedPhone)
        .single();

      if (fetchError || !verification) {
        return NextResponse.json({ error: "No pending WhatsApp verification. Request a new code." }, { status: 400 });
      }

      if (new Date(verification.expires_at) < new Date()) {
        return NextResponse.json({ error: "OTP expired. Please request a new one." }, { status: 400 });
      }

      if (verification.attempts >= 5) {
        return NextResponse.json({ error: "Too many attempts. Please request a new OTP." }, { status: 400 });
      }

      if (verification.code !== code.toString().trim()) {
        await adminClient
          .from("verifications")
          .update({ attempts: verification.attempts + 1 })
          .eq("id", verification.id);
        return NextResponse.json({ error: "Invalid OTP" }, { status: 400 });
      }

      // Mark verified
      await adminClient
        .from("verifications")
        .update({ verified_at: new Date().toISOString() })
        .eq("id", verification.id);

      // Mark MFA enrolled in profile (using adminClient or userClient; admin for consistency)
      await adminClient
        .from("profiles")
        .update({ mfa_enrolled: true })
        .eq("user_id", userId);

      // Cleanup verification row
      await adminClient.from("verifications").delete().eq("identifier", formattedPhone);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid method" }, { status: 400 });
  } catch (error) {
    console.error("Verify enrollment error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
