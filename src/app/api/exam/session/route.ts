import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { z } from "zod";

const CreateSessionSchema = z.object({ test_id: z.string().uuid() });

export async function POST(req: NextRequest) {
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
  const parsed = CreateSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { test_id } = parsed.data;

  // Check for an existing in_progress session (resumption)
  const { data: existing } = await supabase
    .from("exam_sessions")
    .select("id, time_remaining_s")
    .eq("test_id", test_id)
    .eq("user_id", user.id)
    .eq("status", "in_progress")
    .maybeSingle();

  if (existing) {
    const { data: savedAnswers } = await supabase
      .from("exam_answers")
      .select("question_id, selected, is_flagged")
      .eq("session_id", existing.id);

    return NextResponse.json({
      session_id: existing.id,
      time_remaining_s: existing.time_remaining_s,
      saved_answers: savedAnswers ?? [],
      resumed: true,
    });
  }

  // Enforce max_attempts — count only completed sessions
  const { data: test } = await supabase
    .from("tests")
    .select("max_attempts, time_limit")
    .eq("id", test_id)
    .single();

  const { count } = await supabase
    .from("exam_sessions")
    .select("*", { count: "exact", head: true })
    .eq("test_id", test_id)
    .eq("user_id", user.id)
    .neq("status", "in_progress");

  if (test?.max_attempts && (count ?? 0) >= test.max_attempts) {
    return NextResponse.json({ error: "Max attempts reached" }, { status: 403 });
  }

  let { data: session, error } = await supabase
    .from("exam_sessions")
    .insert({
      test_id,
      user_id: user.id,
      time_remaining_s: (test?.time_limit ?? 30) * 60,
    })
    .select("id")
    .single();

  // Handle race condition: if another request created a session between our initial SELECT and this INSERT
  if (error && error.code === "23505") {
    const { data: retry } = await supabase
      .from("exam_sessions")
      .select("id, time_remaining_s")
      .eq("test_id", test_id)
      .eq("user_id", user.id)
      .eq("status", "in_progress")
      .maybeSingle();

    if (retry) {
      const { data: savedAnswers } = await supabase
        .from("exam_answers")
        .select("question_id, selected, is_flagged")
        .eq("session_id", retry.id);

      return NextResponse.json({
        session_id: retry.id,
        time_remaining_s: retry.time_remaining_s,
        saved_answers: savedAnswers ?? [],
        resumed: true,
      });
    }
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    session_id: session!.id,
    time_remaining_s: (test?.time_limit ?? 30) * 60,
    saved_answers: [],
    resumed: false,
  }, { status: 201 });
}
