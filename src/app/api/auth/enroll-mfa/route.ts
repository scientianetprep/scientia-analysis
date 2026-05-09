import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { createServerClientFn } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { z } from "zod";

const enrollSchema = z.object({
  method: z.enum(["totp", "whatsapp"]),
});

export async function POST(request: NextRequest) {
  try {

    const origin = request.headers.get("origin") || request.headers.get("referer");
    const allowedOrigin = env.NEXT_PUBLIC_SITE_URL;
    // Allow localhost (dev) and the configured site URL (production)
    const isAllowed = origin?.startsWith(allowedOrigin) || origin?.startsWith("http://localhost");
    if (!isAllowed) {
      console.warn("[enroll-mfa] Origin not allowed", { origin, allowedOrigin });
      return NextResponse.json({ error: "Invalid request" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = enrollSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    const { method } = parsed.data;

     // User client — used for Auth operations (TOTP MFA)
      const userClient = await createServerClientFn();
      const { data: { user }, error: userError } = await userClient.auth.getUser();
      
      if (userError || !user) {
        console.warn("[enroll-mfa] Unauthorized", { userError });
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

     const userId = user.id;

     // Admin client — service role for DB operations (verifications table)
     const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    if (method === "totp") {
      // Before re-enrolling, prune any `unverified` TOTP factors left over
      // from a previous attempt. Supabase enforces a unique `friendly_name`
      // across all factors of the same user — if a prior QR was never
      // confirmed, the leftover row causes "a factor with this friendly
      // name already exists" (bug #6) on every retry. Verified factors are
      // preserved (that's the legitimate dup case — the caller should use
      // /api/auth/mfa/unenroll first).
      const { data: factorsList } = await userClient.auth.mfa.listFactors();
      // Supabase types `.status` as the string literal "verified" only, but
      // at runtime newly-enrolled factors carry "unverified" until the OTP
      // is confirmed — see https://github.com/supabase/auth-js/issues/729.
      // We cast to string to dodge the spurious never-overlap error.
      const staleTotp = (factorsList?.totp ?? []).filter(
        (f) => (f.status as string) !== "verified"
      );
      for (const f of staleTotp) {
        await userClient.auth.mfa.unenroll({ factorId: f.id });
      }

      // Create TOTP factor - uses current session context. Supabase
      // rejects a re-enrollment when the same `friendly_name` already
      // exists for the user, even if the prior factor was unverified. We
      // prune stale factors above, but a second race (two tabs hitting
      // this endpoint at once) can still trip the conflict. To make the
      // flow deterministic we:
      //   1. Append a timestamp suffix so two concurrent requests end up
      //      with distinct friendly names.
      //   2. Swallow the remaining "already exists" error and return the
      //      existing unverified factor's QR instead of 400'ing.
      //
      // Matches plan task 2.2.
      const friendlyName = `Scientia Prep ${new Date().toISOString().slice(0, 10)}`;
      const { data, error } = await userClient.auth.mfa.enroll({
        factorType: "totp",
        issuer: "ScientiaNetPrep",
        friendlyName,
      });

      if (error) {
        const msg = error.message ?? "";
        const code = (error as { code?: string }).code;
        const isConflict =
          code === "mfa_factor_name_conflict" ||
          msg.toLowerCase().includes("already exists");
        if (isConflict) {
           const { data: factors } = await userClient.auth.mfa.listFactors();
          const existing =
            factors?.totp?.find((f) => (f.status as string) !== "verified") ??
            factors?.totp?.[0] ??
            null;
          if (existing) {
            // Re-enroll a fresh factor silently so we can hand the caller
            // a QR. The previous factor has been unenrolled above; this
            // path is the "second tab" safety net.
            const retry = await userClient.auth.mfa.enroll({
              factorType: "totp",
              issuer: "ScientiaNetPrep",
              friendlyName: `${friendlyName} · ${Date.now()}`,
            });
            if (retry.error) {
              return NextResponse.json(
                { error: retry.error.message },
                { status: 400 }
              );
            }
            return NextResponse.json({
              qrCode: retry.data.totp.qr_code,
              secret: retry.data.totp.secret,
              factorId: retry.data.id,
            });
          }
        }
        return NextResponse.json({ error: msg }, { status: 400 });
      }

      // Return QR code for authenticator apps
      return NextResponse.json({
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
        factorId: data.id,
      });
    }

    if (method === "whatsapp") {

      // Get phone from profile
      const { data: profile, error: profileError } = await adminClient
        .from("profiles")
        .select("whatsapp_number")
        .eq("user_id", userId)
        .single();

      if (profileError || !profile?.whatsapp_number) {
        console.error("[enroll-whatsapp] Profile fetch error", { profileError, userId });
        return NextResponse.json({ error: "No phone on file" }, { status: 400 });
      }


      // Format phone for Pakistan
      const formatPhone = (phone: string): string => {
        const cleaned = phone.replace(/\D/g, "");
        if (cleaned.startsWith("0")) return "+92" + cleaned.slice(1);
        if (cleaned.startsWith("3")) return "+92" + cleaned;
        if (cleaned.startsWith("92")) return "+" + cleaned;
        return "+" + cleaned;
      };
      const formattedPhone = formatPhone(profile.whatsapp_number);
      const { data: lastVer } = await adminClient
        .from("verifications")
        .select("created_at, verified_at")
        .eq("identifier", formattedPhone)
        .single();


      if (lastVer?.verified_at) {
        // Already verified - allow proceeding
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

      const { error: upsertError } = await adminClient.from("verifications").upsert(
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
      // Send via Fonnte API directly (bypass Edge Function timeout limit)
      const fonnteUrl = env.FONNTE_ENDPOINT || "https://api.fonnte.com/send";
      const fonnteToken = env.FONNTE_TOKEN;

      if (!fonnteToken) {
        console.error("[enroll-whatsapp] Fonnte token not configured");
        return NextResponse.json(
          { error: "Messaging service unavailable. Please contact support." },
          { status: 500 }
        );
      }

      const sendViaFonnte = async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30_000);

        const formData = new FormData();
        formData.append("target", formattedPhone);
        formData.append("message", `Your MFA verification code is: ${generatedOtp}. This code expires in 5 minutes.`);
        formData.append("countryCode", "0");

        const res = await fetch(fonnteUrl, {
          method: "POST",
          headers: { Authorization: fonnteToken },
          body: formData,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return res;
      };

      let fonnteRes;
      try {
        fonnteRes = await sendViaFonnte();
      } catch (err: any) {
        console.error("[enroll-whatsapp] Direct Fonnte failed, trying Edge Function fallback", err);
        // Fallback: try Edge Function if direct call fails (network issues)
        const edgeRes = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-sms-fonnte`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            user: { phone: formattedPhone },
            sms: { otp: generatedOtp, template: "Your MFA code is: {{otp}}" },
          }),
        });
        if (!edgeRes.ok) {
          const edgeErr = await edgeRes.text();
          console.error("[enroll-whatsapp] Edge Function fallback also failed", edgeErr);
          return NextResponse.json({ error: "Failed to send WhatsApp OTP. Please try again later." }, { status: 500 });
        }
        return NextResponse.json({ success: true, message: "OTP sent to your WhatsApp" });
      }


      if (!fonnteRes.ok) {
        const errText = await fonnteRes.text().catch(() => "Unknown error");
        console.error("[enroll-whatsapp] Fonnte error response", { status: fonnteRes.status, body: errText });
        return NextResponse.json(
          { error: "Failed to send WhatsApp OTP. Please try again later." },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, message: "OTP sent to your WhatsApp" });
    }

    return NextResponse.json({ error: "Invalid method" }, { status: 400 });
  } catch (error) {
    console.error("Enroll MFA error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
