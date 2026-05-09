import { NextRequest, NextResponse } from "next/server";
import { createServerClientFn } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createServerClientFn();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // Return an empty array instead of an error object. The dashboard renders
    // this endpoint inline without auth gates during initial hydration, and
    // a {error: ...} shape would crash <WeakAreaAnalysis>'s .map().
    return NextResponse.json([], { status: 200 });
  }

  try {
    // 1. Get all answers for this user
    // We filter by sessions that are 'submitted' for accuracy analytics
    const { data: answers, error } = await supabase
      .from("exam_answers")
      .select(`
        selected,
        questions (
          id,
          topic,
          subject,
          correct
        ),
        exam_sessions!inner (
          status,
          user_id
        )
      `)
      .eq("exam_sessions.user_id", user.id)
      .eq("exam_sessions.status", "submitted");

    if (error) throw error;

    // 2. Process data to group by topic
    const analysis: Record<string, { subject: string, topic: string, total: number, correct: number }> = {};

    answers.forEach((ans: any) => {
      const q = ans.questions;
      if (!q || !q.topic) return;

      const key = `${q.subject}:${q.topic}`;
      if (!analysis[key]) {
        analysis[key] = { subject: q.subject, topic: q.topic, total: 0, correct: 0 };
      }

      analysis[key].total += 1;
      if (ans.selected === q.correct) {
        analysis[key].correct += 1;
      }
    });
    // 3. Convert to array and calculate accuracy
    const results = Object.values(analysis)
      .map(item => ({
        ...item,
        accuracy: (item.correct / item.total) * 100
      }))
      .filter(item => item.total >= 3) // Need at least 3 attempts for meaningful data
      .sort((a, b) => a.accuracy - b.accuracy); // Weakest first

    // 4. Enrich weak areas with lesson recommendations
    const enrichedResults = await Promise.all(results.map(async (area) => {
      if (area.accuracy >= 75) return area;

      const { data: recommendations } = await supabase
        .from("lessons")
        .select("id, title, course_id")
        .eq("topic", area.topic)
        .limit(2);
      
      return { ...area, recommendations: recommendations || [] };
    }));

    return NextResponse.json(enrichedResults);
  } catch (error: any) {
    console.error("[weak-areas] analysis failed:", error?.message);
    // Fail soft — the dashboard should degrade gracefully rather than showing
    // a broken card when the analysis join has no rows yet or RLS trips.
    return NextResponse.json([], { status: 200 });
  }
}
