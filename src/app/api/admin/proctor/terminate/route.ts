import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createServerClientFn } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin({ context: "api" });
    const { sessionId } = await req.json();
    if (!sessionId) throw new Error("session_id is required");

    const supabase = await createServerClientFn();
    
    // Mark as auto_submitted by admin. We stamp ended_at so the proctor
    // dashboard stops counting elapsed time, and submitted_at so downstream
    // analytics that filter on a single timestamp still see the close.
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("exam_sessions")
      .update({
        status: "auto_submitted",
        ended_at: now,
        submitted_at: now,
        time_remaining_s: 0,
      })
      .eq("id", sessionId)
      .select()
      .single();

    if (error) throw error;

    // Log the action
    await supabase.from("admin_audit_log").insert({
      admin_id: (await supabase.auth.getUser()).data.user?.id,
      action: "force_terminate_session",
      target_user_id: data.user_id,
      metadata: { session_id: sessionId }
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
