import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { AttemptSubmitSchema } from "@/lib/schemas/exam-session";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cs) =>
            cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = AttemptSubmitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    }

    const { session_id, answers, time_taken, status: requestedStatus } = parsed.data as any;

    // 1. Validate session ownership and active status
    const { data: session, error: sessionError } = await supabase
      .from("exam_sessions")
      .select("user_id, test_id, status")
      .eq("id", session_id)
      .single();

    if (sessionError || !session || session.user_id !== user.id || session.status !== "in_progress") {
      console.warn(`[Submit] Invalid session attempt: ID=${session_id}, Status=${session?.status}, User=${user.id}`);
      return NextResponse.json({ error: "Invalid or already-submitted session" }, { status: 403 });
    }

    // 2. Load test config for scoring
    const { data: test } = await supabase
      .from("tests")
      .select("question_ids, negative_marking")
      .eq("id", session.test_id)
      .single();

    // 3. Load all questions for this test
    const { data: questions } = await supabase
      .from("questions")
      .select("id, correct, marks")
      .in("id", test?.question_ids ?? []);

    // 4. Compute score with negative marking support
    let raw = 0;
    let totalMarks = 0;
    const questionsList = questions ?? [];
    
    for (const q of questionsList) {
      const qMarks = q.marks ?? 1;
      totalMarks += qMarks;
      const selected = answers[q.id];
      if (selected === q.correct) {
        raw += qMarks;
      } else if (selected) {
        raw -= (test?.negative_marking ?? 0);
      }
    }
    
    const finalScore = Math.max(0, raw);
    const correctCount = questionsList.filter((q) => answers[q.id] === q.correct).length;
    const percentage = totalMarks > 0 ? (finalScore / totalMarks) * 100 : 0;

    // 5. Insert score record using standard client (RLS applies)
    const { data: scoreRow, error: scoreErr } = await supabase
      .from("scores")
      .insert({
        user_id: user.id,
        test_id: session.test_id,
        correct_count: correctCount,
        total_count: questionsList.length,
        percentage,
        time_taken_seconds: time_taken,
      })
      .select("id")
      .single();

    if (scoreErr) {
      console.error("[Submit] Failed to insert score:", scoreErr);
      return NextResponse.json({ error: "Failed to record score" }, { status: 500 });
    }

    // 6. Finalize Session (Move to 'submitted')
    // We use the ADMIN CLIENT to ensure we bypass RLS for status updates.
    const adminClient = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY
    );

    const now = new Date().toISOString();
    
    // Map the status to allowed DB values. We allow 'submitted', 'timed_out', 'auto_submitted'.
    const finalStatus = ["submitted", "timed_out", "auto_submitted"].includes(requestedStatus) 
      ? requestedStatus 
      : "submitted";

    const { error: submitError } = await adminClient
      .from("exam_sessions")
      .update({
        status: finalStatus,
        submitted_at: now,
        ended_at: now,
        score_id: scoreRow.id,
        time_remaining_s: 0, // Ensure timer stops on server side resume
      })
      .eq("id", session_id);

    if (submitError) {
      console.error("[Submit] CRITICAL: Failed to update session status after scoring:", submitError);
      // Even if this fails, the score is already recorded.
      return NextResponse.json({ error: "Score saved but session finalization failed" }, { status: 500 });
    }

    // 7. Update Question Usage Counts (Fire and forget-ish)
    // We don't block the response on this maintenance task.
    if (questionsList.length > 0) {
      // Re-fetch with usage_count for update
      const { data: usageData } = await adminClient
        .from("questions")
        .select("id, usage_count")
        .in("id", test?.question_ids ?? []);

      if (usageData) {
        Promise.allSettled(
          usageData.map((q) =>
            adminClient
              .from("questions")
              .update({ usage_count: (q.usage_count ?? 0) + 1 })
              .eq("id", q.id)
          )
        ).then(results => {
          const failures = results.filter(r => r.status === 'rejected');
          if (failures.length > 0) console.warn(`[Submit] ${failures.length} usage count updates failed`);
        });
      }
    }

    return NextResponse.json({ ok: true, score_id: scoreRow.id });
  } catch (error: any) {
    console.error("[Submit] Global fatal error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
