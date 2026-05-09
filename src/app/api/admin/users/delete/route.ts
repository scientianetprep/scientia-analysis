import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { emailTemplates, sendEmail } from "@/lib/email";

/**
 * POST /api/admin/users/delete
 *
 * Handles admin review of account-deletion requests.
 *   action = "reject"   → mark request rejected, account stays active.
 *   action = "approve"  → schedule the account for deletion in 7 days.
 *                         Does NOT hard-delete here — a cron sweeps expired
 *                         grace windows and performs the real auth delete.
 *                         The user gets an email with a revoke link.
 */

const GRACE_PERIOD_DAYS = 7;

export async function POST(req: NextRequest) {
  try {
    const result = await requireAdmin({ context: "api" });
    if (result instanceof Response) return result;
    const { user: adminSession } = result;
    const { requestId, action, userId } = await req.json();

    if (!requestId || !action || !userId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // --- REJECT -------------------------------------------------------------
    if (action === "reject") {
      const { error } = await supabaseAdmin
        .from("account_deletion_requests")
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          reviewed_by: adminSession.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (error) throw error;

      await supabaseAdmin.from("admin_audit_log").insert({
        admin_id: adminSession.id,
        action: `Rejected deletion request for user ${userId}`,
        ip_address: req.headers.get("x-forwarded-for"),
      });

      return NextResponse.json({ success: true, action: "rejected" });
    }

    // --- APPROVE (schedule for deletion in 7 days) --------------------------
    if (action === "approve") {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("email, full_name")
        .eq("user_id", userId)
        .single();

      const scheduledAt = new Date(
        Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
      ).toISOString();

      // 1. Mark the deletion request as "scheduled"
      const { error: reqErr } = await supabaseAdmin
        .from("account_deletion_requests")
        .update({
          status: "scheduled",
          reviewed_at: new Date().toISOString(),
          reviewed_by: adminSession.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);
      if (reqErr) throw reqErr;

      // 2. Flip profile status + schedule stamp so the login banner + RLS
      //    gates can see the grace window.
      const { error: profileErr } = await supabaseAdmin
        .from("profiles")
        .update({
          status: "scheduled_for_deletion",
          deletion_scheduled_at: scheduledAt,
        })
        .eq("user_id", userId);
      if (profileErr) throw profileErr;

      // 3. Audit log.
      await supabaseAdmin.from("admin_audit_log").insert({
        admin_id: adminSession.id,
        action: `Scheduled deletion for user ${userId} (grace ends ${scheduledAt})`,
        ip_address: req.headers.get("x-forwarded-for"),
      });

      // 4. Email the user with a revoke link — non-blocking.
      if (profile?.email) {
        sendEmail({
          to: profile.email,
          subject:
            "Scientia Prep — Your account is scheduled for deletion in 7 days",
          html: emailTemplates.accountDeletion(profile.full_name || "Student"),
        }).catch((e) =>
          console.error("Scheduled-deletion email failed", e)
        );
      }

      return NextResponse.json({
        success: true,
        action: "scheduled",
        scheduledAt,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Admin Deletion Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
