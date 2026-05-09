import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { AutoSaveSchema } from "@/lib/schemas";

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
  const parsed = AutoSaveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { session_id, question_id, selected, is_flagged, time_remaining_s } = parsed.data;

  // Verify session ownership and status
  const { data: session } = await supabase
    .from("exam_sessions")
    .select("user_id, status")
    .eq("id", session_id)
    .single();

  if (!session || session.user_id !== user.id || session.status !== "in_progress") {
    return NextResponse.json({ error: "Invalid or expired session" }, { status: 403 });
  }

  const { error } = await supabase.from("exam_answers").upsert(
    {
      session_id,
      question_id,
      selected,
      is_flagged: is_flagged ?? false,
      answered_at: new Date().toISOString(),
    },
    { onConflict: "session_id,question_id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Persist server-side remaining time so resume/session timeout is reliable.
  if (typeof time_remaining_s === "number") {
    const { error: sessionUpdateError } = await supabase
      .from("exam_sessions")
      .update({ time_remaining_s })
      .eq("id", session_id)
      .eq("status", "in_progress");

    if (sessionUpdateError) {
      return NextResponse.json({ error: sessionUpdateError.message }, { status: 400 });
    }
  }

  return NextResponse.json({ success: true });
}
