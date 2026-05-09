import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { sendEmail, emailTemplates } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin({ context: "api" });
    const { to, subject, message, targetType, selectedUserIds } = await req.json();

    if (!subject || !message) {
      return NextResponse.json({ error: "Subject and message are required" }, { status: 400 });
    }

    const adminClient = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Plan-P4.13 / bug #21: admins routinely write messages like
    //   "Hi {{full_name}}, your exam has been graded..."
    // The previous implementation sent the literal template text to every
    // recipient because we never looked up names — students would receive
    // "Hi {{full_name}}". We now fetch (email, full_name) pairs so we can
    // do a per-recipient substitution before templating. Custom emails
    // entered as free text fall back to the raw local part (before the @).
    type Recipient = { email: string; full_name: string | null };
    let recipients: Recipient[] = [];

    if (targetType === "single" && to) {
      const { data: profile } = await adminClient
        .from("profiles")
        .select("email, full_name")
        .eq("email", to)
        .maybeSingle();
      recipients = [{ email: to, full_name: profile?.full_name ?? null }];
    } else if (targetType === "all_students") {
      const { data: profiles, error } = await adminClient
        .from("profiles")
        .select("email, full_name")
        .eq("role", "student")
        .eq("status", "active");
      if (error) throw error;
      recipients = (profiles ?? [])
        .filter((p) => !!p.email)
        .map((p) => ({ email: p.email as string, full_name: p.full_name ?? null }));
    } else if (targetType === "selected" && Array.isArray(selectedUserIds) && selectedUserIds.length > 0) {
      const { data: profiles, error } = await adminClient
        .from("profiles")
        .select("email, full_name")
        .in("user_id", selectedUserIds);
      if (error) throw error;
      recipients = (profiles ?? [])
        .filter((p) => !!p.email)
        .map((p) => ({ email: p.email as string, full_name: p.full_name ?? null }));
    } else if (targetType === "custom" && Array.isArray(to)) {
      recipients = (to as string[]).map((email) => ({ email, full_name: null }));
    } else {
      return NextResponse.json({ error: "Invalid target type or missing recipient" }, { status: 400 });
    }

    if (recipients.length === 0) {
      return NextResponse.json({ error: "No recipients found" }, { status: 400 });
    }

    // Supported tokens — keep this list small and documented. We accept
    // {{full_name}}, {{first_name}} and {{email}}. Token replacement is a
    // literal string replace, not a template engine, so there's no risk
    // of accidentally executing anything untrusted.
    const renderFor = (r: Recipient) => {
      const localPart = r.email.split("@")[0] ?? "";
      const name = (r.full_name ?? "").trim() || localPart || "there";
      const first = name.split(/\s+/)[0] ?? name;
      const subj = subject
        .replaceAll("{{full_name}}", name)
        .replaceAll("{{first_name}}", first)
        .replaceAll("{{email}}", r.email);
      const body = message
        .replaceAll("{{full_name}}", name)
        .replaceAll("{{first_name}}", first)
        .replaceAll("{{email}}", r.email);
      return { subj, html: emailTemplates.customAdminMessage(subj, body) };
    };

    const results = await Promise.allSettled(
      recipients.map((r) => {
        const { subj, html } = renderFor(r);
        return sendEmail({ to: r.email, subject: subj, html });
      })
    );

    const succeeded = results.filter(r => r.status === "fulfilled").length;
    const failed = results.filter(r => r.status === "rejected").length;

    return NextResponse.json({ 
      success: true, 
      message: `Sent to ${succeeded} recipients. ${failed} failed.`,
      succeeded,
      failed
    });

  } catch (error: any) {
    console.error("Email Compose Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
