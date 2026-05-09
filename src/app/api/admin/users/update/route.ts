import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  try {
    const result = await requireAdmin({ context: "api" });
    if (result instanceof Response) return result;
    const { user: adminSession } = result;
    const { userId, role, status, courseTier } = await req.json();

    if (!userId && !role && !status && !courseTier) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Service role bypasses RLS
    const supabaseAdmin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Don't let an admin change their own role/status here to prevent accidental lockouts
    if (userId === adminSession.id) {
       return NextResponse.json({ error: "You cannot modify your own role or status through this endpoint." }, { status: 403 });
    }

    if (userId === "cleanup-tiers") {
      // Delete all and repopulate from profiles
      const { data: activeTiers } = await supabaseAdmin
        .from("profiles")
        .select("course_tier")
        .not("course_tier", "is", null);

      const uniqueTiers = Array.from(new Set(activeTiers?.map(t => t.course_tier).filter(Boolean)));

      await supabaseAdmin.from("saved_course_tiers").delete().neq("tier", "STAY_TRICK"); // delete all
      
      if (uniqueTiers.length > 0) {
        await supabaseAdmin
          .from("saved_course_tiers")
          .insert(uniqueTiers.map(t => ({ tier: t })));
      }

      return NextResponse.json({ success: true, message: "Tiers cleaned up" });
    }

    // Read current role so we can detect a role change and force a fresh JWT
    // on the target user's next request. Without this step, the old cached JWT
    // keeps its stale `role` claim until it expires — which is the root cause
    // of "I promoted the user to admin but they still see the student UI"
    // reports (plan-P2.5).
    const { data: before } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("user_id", userId)
      .single();

    const updates: any = { updated_at: new Date().toISOString() };
    if (role) updates.role = role;
    if (status) updates.status = status;
    if (courseTier) updates.course_tier = courseTier;

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update(updates)
      .eq("user_id", userId);
      
    if (updateError) throw updateError;

    if (courseTier && courseTier.trim()) {
      await supabaseAdmin
        .from("saved_course_tiers")
        .upsert({ tier: courseTier.trim() }, { onConflict: 'tier', ignoreDuplicates: true });
    }

    // If the role actually changed, invalidate every active session for the
    // target user. The next request they make will re-hydrate a JWT with the
    // new role claim.
    if (role && before && before.role !== role) {
      try {
        await supabaseAdmin.auth.admin.signOut(userId, "global");
      } catch (e) {
        // signOut() is best-effort — don't fail the whole update if the
        // admin API rejects the scope (e.g. user has no active session).
        console.warn("[v0] signOut(target) failed:", e);
      }
    }

    // Log the action
    await supabaseAdmin.from("admin_audit_log").insert({
      admin_id: adminSession.id,
      action: `Updated user ${userId} - Role: ${role || 'N/A'}, Status: ${status || 'N/A'}, Tier: ${courseTier || 'N/A'}`,
      ip_address: req.headers.get("x-forwarded-for"),
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Admin Update User Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
