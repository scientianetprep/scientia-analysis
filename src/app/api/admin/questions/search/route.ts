import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

export async function GET(req: NextRequest) {
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

  const { searchParams } = new URL(req.url);
  const subject = searchParams.get("subject");
  const q = searchParams.get("q");
  // Optional status filter — when absent we return every non-retired
  // row so the test builder can see drafts, reviews, and approved
  // questions (this is the internal admin bank picker, not the
  // student-facing catalogue). Previously the route hard-filtered by
  // `status = 'approved'` which silently hid bulk-imported questions
  // that came in with the schema default `status = 'draft'`.
  const status = searchParams.get("status");

  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "50");
  const from = (page - 1) * pageSize;

  let query = supabase
    .from("questions")
    .select("id, text, subject, topic, difficulty, status, image_url, image_position", { count: "exact" })
    .neq("status", "retired")
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (status) query = query.eq("status", status);
  if (subject) query = query.eq("subject", subject);
  if (q) query = query.ilike("text", `%${q}%`);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ 
    questions: data ?? [],
    count: count ?? 0,
    totalPages: Math.ceil((count ?? 0) / pageSize)
  });
}
