import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createServerClientFn } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { emailTemplates, sendEmail } from "@/lib/email";

/**
 * POST /api/user/deletion/revoke
 *
 * Cancels a deletion request in either `pending` or `scheduled` state. Also
 * clears `profiles.deletion_scheduled_at` and resets `profiles.status` from
 * `scheduled_for_deletion` back to `active` so RLS and the login banner see
 * the account as fully restored.
 */
export async function POST(_req: NextRequest) {
  const supabase = await createServerClientFn();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use service-role for the multi-table update so we don't race against RLS
  // during the brief moment profile.status is flipped.
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // 1. Flip the request row. Accept either pending (user just submitted) or
    //    scheduled (admin approved, grace window running).
    const { data: updated, error: updateErr } = await admin
      .from("account_deletion_requests")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .in("status", ["pending", "scheduled"])
      .select("id, status")
      .maybeSingle();

    if (updateErr) throw updateErr;
    if (!updated) {
      return NextResponse.json(
        { error: "No active deletion request to revoke." },
        { status: 404 }
      );
    }

    // 2. Clear the profile's scheduled timestamp and reset status if needed.
    //    Only downgrade status away from scheduled_for_deletion — leave other
    //    states (e.g. suspended) alone.
    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("full_name, email, status")
      .eq("user_id", user.id)
      .single();

    if (profileErr) throw profileErr;

    const nextStatus =
      profile?.status === "scheduled_for_deletion" ? "active" : profile?.status;

    await admin
      .from("profiles")
      .update({
        deletion_scheduled_at: null,
        status: nextStatus,
      })
      .eq("user_id", user.id);

    // 3. Fire-and-forget confirmation email — never block the revoke on email failures.
    if (profile?.email) {
      sendEmail({
        to: profile.email,
        subject: "Scientia Prep — Account deletion cancelled",
        html: emailTemplates.accountDeletionRevoked(profile.full_name || "Student"),
      }).catch((e) => console.error("Revocation email failed:", e));
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Revocation API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
