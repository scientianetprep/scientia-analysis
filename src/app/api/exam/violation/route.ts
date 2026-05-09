import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { ViolationEventSchema } from "@/lib/schemas";

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
  const parsed = ViolationEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { session_id, violation_type, details } = parsed.data;

  // Verify session ownership
  const { data: session } = await supabase
    .from("exam_sessions")
    .select("user_id, status, violation_count")
    .eq("id", session_id)
    .single();

  if (!session || session.user_id !== user.id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 403 });
  }

  // Insert violation record
  await supabase.from("violations").insert({
    session_id,
    violation_type,
    details: details ?? {},
  });

  // Atomically increment violation_count on the session
  const newCount = await supabase.rpc("increment_violation_count", {
    session_uuid: session_id,
  });

  return NextResponse.json({
    success: true,
    violation_count: newCount.data ?? (session.violation_count ?? 0) + 1,
  });
}
