import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await requireAdmin({ context: "api" });
    const { userId } = await params;
    
    const adminClient = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY
    );
    const authUser = await adminClient.auth.admin.getUserById(userId);

    // Fetch profile
    const { data: profile } = await adminClient
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    // Fetch academic info
    const { data: academic } = await adminClient
      .from("academic_info")
      .select("*")
      .eq("user_id", userId)
      .single();

    // Fetch scores with test info
    const { data: scores } = await adminClient
      .from("scores")
      .select("*, tests(name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    // Fetch exam sessions
    const { data: recentSessions } = await adminClient
      .from("exam_sessions")
      .select("*, tests(name)")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(5);

    // Fetch login history
    const { data: loginHistory } = await adminClient
      .from("login_history")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    // Fetch feedback submissions
    const { data: feedback } = await adminClient
      .from("feedback")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);

    // Fetch payments
    const { data: payments } = await adminClient
      .from("payments")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    // Fetch lesson completions
    const { data: lessonCompletions } = await adminClient
      .from("lesson_completions")
      .select("id")
      .eq("user_id", userId);

    // Fetch all user-linked records across known tables
    const userLinkedTables = [
      "academic_info",
      "account_deletion_requests",
      "admin_audit_log",
      "course_access_grants",
      "download_requests",
      "exam_sessions",
      "feedback",
      "lesson_completions",
      "login_history",
      "mfa_email_codes",
      "payments",
      "personal_notes",
      "scores",
      "student_streaks",
      "user_preferences",
      "verifications",
    ];

    const rawDbRecords: Record<string, any[]> = {};
    await Promise.all(
      userLinkedTables.map(async (table) => {
        const { data } = await adminClient
          .from(table)
          .select("*")
          .eq("user_id", userId)
          .limit(200);
        rawDbRecords[table] = data ?? [];
      })
    );

    return NextResponse.json({
      authUser: authUser.data?.user ?? null,
      profile,
      academic,
      scores,
      recentSessions,
      loginHistory,
      feedback,
      payments,
      rawDbRecords,
      stats: {
        totalLessonsCompleted: lessonCompletions?.length || 0,
        totalTestsTaken: scores?.length || 0,
        averageScore: (scores?.length ?? 0) > 0 
            ? scores!.reduce((sum, s) => sum + Number(s.percentage || 0), 0) / scores!.length 
            : 0,
      }
    });
  } catch (error: any) {
    console.error("Admin user details error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}