import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { StudentDashboard } from "@/components/dashboard/StudentDashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch Profile & Role from DB
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, full_name, status, created_at, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.status !== "active") {
    redirect(profile?.status === "pending" ? "/pending" : "/login");
  }

  // Role detection (JWT first, fallback to DB)
  const { data: { session } } = await supabase.auth.getSession();
  let role = profile.role || "student";

  if (session?.access_token) {
    try {
      const payload = JSON.parse(atob(session.access_token.split(".")[1]));
      role = payload?.custom_claims?.role || role;
    } catch {
      // malformed JWT — fall through to DB role
    }
  }

  // ── STUDENT STATS ──────────────────────────────────────────────────────────
  const [
    { count: totalAttempts },
    { data: bestScoreData },
    { count: lessonsCompleted },
    { data: recentScores },
    { data: preferences },
    { data: streakData },
    { data: activeSessionData },
    { count: totalLessons },
    { data: recentCourseData },
  ] = await Promise.all([
    supabase.from("scores").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("scores").select("percentage").eq("user_id", user.id).order("percentage", { ascending: false }).limit(1),
    supabase.from("lesson_completions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("scores").select("id, created_at, percentage, tests(name)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(3),
    supabase.from("user_preferences").select("mfa_prompt_dismissed").eq("user_id", user.id).single(),
    supabase.from("student_streaks").select("current_streak").eq("user_id", user.id).maybeSingle(),
    supabase.from("exam_sessions").select("id, test_id, tests(name)").eq("user_id", user.id).eq("status", "in_progress").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    // Only count lessons that students can *actually* open — i.e. the
    // lesson itself is published AND belongs to a currently-published,
    // non-deleted course. Before this filter the hero card showed e.g.
    // "8 Available" for a DB that was entirely drafts, which confused
    // students when /dashboard/courses turned out to be empty.
    supabase
      .from("lessons")
      .select("id, courses!inner(is_published, deleted_at, status)", {
        count: "exact",
        head: true,
      })
      .eq("is_published", true)
      .eq("courses.is_published", true)
      .is("courses.deleted_at", null)
      .neq("courses.status", "archived"),
    supabase.from("lesson_completions").select("created_at, lessons(course_id, courses(id, title, subject))").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const currentStreak = streakData?.current_streak || 0;

  const bestScore = (bestScoreData as any)?.[0]?.percentage || 0;
  const activeSession = activeSessionData as any;
  const recentCourse = (recentCourseData as any)?.lessons?.courses;

  const createdDate = new Date(profile.created_at);
  const daysActive = Math.max(1, Math.ceil((new Date().getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)));

  // Determine if MFA prompt should be shown
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const isEnrolled = factors?.all?.some((f: { status: string }) => f.status === "verified");
  const showMfaPrompt = !isEnrolled && !preferences?.mfa_prompt_dismissed;

  return (
    <StudentDashboard
      profile={profile}
      showMfaPrompt={showMfaPrompt}
      activeSession={activeSession}
      stats={{
        totalAttempts: totalAttempts || 0,
        bestScore,
        lessonsCompleted: lessonsCompleted || 0,
        totalLessons: totalLessons || 0,
        recentCourse,
        recentScores: recentScores || [],
        daysActive,
        currentStreak,
      }}
    />
  );
}
