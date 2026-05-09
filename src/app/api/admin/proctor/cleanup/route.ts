import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin({ context: "api" });

    const adminClient = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Delete all sessions that are NOT in_progress. 
    // This will cascade to violations and exam_answers if set up correctly.
    const { error, count } = await adminClient
      .from("exam_sessions")
      .delete({ count: "exact" })
      .neq("status", "in_progress");

    if (error) throw error;

    // Log the bulk action
    await adminClient.from("admin_audit_log").insert({
      admin_id: (await adminClient.auth.getUser()).data.user?.id,
      action: "bulk_cleanup_proctor_logs",
      metadata: { deleted_count: count }
    });

    return NextResponse.json({ success: true, deleted_count: count });
  } catch (error: any) {
    console.error("[Proctor Cleanup] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
