import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";

const SupportSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  email: z.string().email("A valid email is required").max(200),
  subject: z.string().min(3, "Subject is too short").max(160),
  message: z.string().min(10, "Message is too short").max(4000),
});

/**
 * Public endpoint that accepts a support enquiry from the login / register
 * screens. We send:
 *   1. A ticket email to the configured support inbox
 *      (SUPPORT_EMAIL env var, falling back to GMAIL_USER which is the
 *      admin inbox already configured for transactional mail).
 *   2. A short confirmation email back to the submitter so they know the
 *      ticket was received.
 *
 * Intentionally unauthenticated — users can't reach the dashboard when
 * they're locked out, which is exactly when this form is most useful.
 * We rely on Gmail's throttling + the schema length caps to avoid abuse.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = SupportSchema.safeParse(body);
    if (!parsed.success) {
      const first =
        parsed.error.issues[0]?.message ?? "Invalid support request";
      return NextResponse.json({ error: first }, { status: 400 });
    }

    const { name, email, subject, message } = parsed.data;

    const esc = (s: string) =>
      s.replace(/[&<>"']/g, (c) =>
        c === "&"
          ? "&amp;"
          : c === "<"
            ? "&lt;"
            : c === ">"
              ? "&gt;"
              : c === '"'
                ? "&quot;"
                : "&#39;"
      );

    // Inbox selection order:
    //   1. site_settings.support_email (admin-configurable from /admin/settings)
    //   2. env.ADMIN_EMAIL (documented transactional-mail fallback)
    //   3. env.GMAIL_USER (the SMTP account — will always exist if mail works)
    const anon = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false } }
    );
    const { data: settings } = await anon
      .from("site_settings")
      .select("support_email")
      .eq("id", 1)
      .maybeSingle();

    const supportInbox =
      settings?.support_email || env.ADMIN_EMAIL || env.GMAIL_USER;
    if (!supportInbox) {
      console.error("[v0] support route: no support inbox configured");
      return NextResponse.json(
        { error: "Support is temporarily unavailable" },
        { status: 500 }
      );
    }

    // Ticket to the support team
    await sendEmail({
      to: supportInbox,
      subject: `[Support] ${subject}`,
      html: `
        <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;">
          <h2 style="margin:0 0 12px 0;font-size:18px;">New support request</h2>
          <p style="margin:0 0 6px 0;color:#555;font-size:13px;">
            <strong>From:</strong> ${esc(name)} &lt;${esc(email)}&gt;
          </p>
          <p style="margin:0 0 12px 0;color:#555;font-size:13px;">
            <strong>Subject:</strong> ${esc(subject)}
          </p>
          <div style="padding:12px;border:1px solid #e5e5e5;border-radius:8px;background:#fafafa;white-space:pre-wrap;font-size:14px;color:#222;">${esc(
            message
          )}</div>
          <p style="margin:12px 0 0 0;color:#888;font-size:11px;">
            Reply to this email to respond directly to ${esc(email)}.
          </p>
        </div>`,
    });

    // Confirmation back to submitter — fire-and-forget; don't fail the
    // request if this one bounces.
    sendEmail({
      to: email,
      subject: "We received your message",
      html: `
        <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;color:#222;">
          <h2 style="margin:0 0 10px 0;font-size:18px;">Thanks, ${esc(name)}.</h2>
          <p style="margin:0 0 10px 0;font-size:14px;line-height:1.55;">
            Our team received your support request about
            &ldquo;${esc(subject)}&rdquo; and will get back to you within one
            business day.
          </p>
          <p style="margin:0;color:#777;font-size:12px;">— Scientia Prep Support</p>
        </div>`,
    }).catch((e: unknown) => {
      console.warn("[v0] support confirmation email failed:", e);
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[v0] support form error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to submit your request" },
      { status: 500 }
    );
  }
}
