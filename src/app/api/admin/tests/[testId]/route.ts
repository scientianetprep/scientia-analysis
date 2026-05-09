import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { TestConfigSchema } from "@/lib/schemas";

type Params = { params: Promise<{ testId: string }> };

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
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
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { testId } = await params;
  const supabase = await getSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("tests")
    .select("id, name, subject, time_limit, question_ids, is_published, description, instructions, negative_marking, shuffle_questions, shuffle_options, max_attempts, pass_percentage, is_mock, access_password, scheduled_open, scheduled_close, show_results, show_explanations, created_at, updated_at, created_by")
    .eq("id", testId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  return NextResponse.json({ test: data });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { testId } = await params;
  const supabase = await getSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const result = TestConfigSchema.partial().safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 422 });
  }

  const { error } = await supabase
    .from("tests")
    .update({ ...result.data, updated_at: new Date().toISOString() })
    .eq("id", testId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { testId } = await params;
  const supabase = await getSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Unpublish instead of hard-delete to preserve historical scores
  const { error } = await supabase
    .from("tests")
    .update({ is_published: false, updated_at: new Date().toISOString() })
    .eq("id", testId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}
