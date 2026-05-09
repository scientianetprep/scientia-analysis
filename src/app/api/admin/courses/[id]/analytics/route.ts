import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin({ context: "api" });
    const { id: courseId } = await params;
    const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    const [{ count: enrolled }, { count: lessonsCount }, { data: activeSessions }] = await Promise.all([
      adminClient.from("course_access_grants").select("*", { count: "exact", head: true }).eq("course_id", courseId).eq("is_active", true),
      adminClient.from("lessons").select("*", { count: "exact", head: true }).eq("course_id", courseId),
      adminClient
        .from("exam_sessions")
        .select("user_id, started_at, tests(subject)")
        .order("started_at", { ascending: false })
        .limit(1000),
    ]);

    const now = Date.now();
    const last30 = now - 30 * 24 * 60 * 60 * 1000;
    const activeUsers = new Set(
      (activeSessions || [])
        .filter((s: any) => s?.started_at && new Date(s.started_at).getTime() >= last30)
        .map((s: any) => s.user_id)
    ).size;

    const { data: completionRows } = await adminClient
      .from("lesson_completions")
      .select("user_id, lesson_id, created_at, lessons(course_id)")
      .order("created_at", { ascending: false })
      .limit(5000);

    const courseCompletions = (completionRows || []).filter((r: any) => r.lessons?.course_id === courseId);
    const byUser = new Map<string, Set<string>>();
    for (const row of courseCompletions) {
      if (!byUser.has(row.user_id)) byUser.set(row.user_id, new Set());
      byUser.get(row.user_id)!.add(row.lesson_id);
    }

    const totalLessons = lessonsCount || 0;
    const progressValues = Array.from(byUser.values()).map((set) => (totalLessons > 0 ? (set.size / totalLessons) * 100 : 0));
    const averageProgress = progressValues.length > 0 ? progressValues.reduce((a, b) => a + b, 0) / progressValues.length : 0;
    const completionRate =
      (enrolled || 0) > 0
        ? (Array.from(byUser.values()).filter((set) => totalLessons > 0 && set.size >= totalLessons).length / (enrolled || 1)) * 100
        : 0;

    return NextResponse.json({
      enrolled: enrolled || 0,
      activeStudents30d: activeUsers,
      totalLessons,
      completionRate: Number(completionRate.toFixed(2)),
      averageProgress: Number(averageProgress.toFixed(2)),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

