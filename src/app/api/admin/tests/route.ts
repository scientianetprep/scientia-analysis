import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { TestConfigSchema } from "@/lib/schemas/test";

export async function GET(req: NextRequest) {
  try {
    const result1 = await requireAdmin({ context: "api", redirectToMfa: false });
    if (result1 instanceof Response) return result1;
    const { supabase } = result1;

    const { data, error } = await supabase
      .from("tests")
      .select("id, name, subject, is_published, is_mock, max_attempts, created_at, question_ids")
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ tests: data });
  } catch (err: any) {
    if (err.message === "MFA_REQUIRED") return NextResponse.json({ error: "MFA Required" }, { status: 403 });
    if (err.message === "NOT_FOUND") return NextResponse.json({ error: "Not Found" }, { status: 404 });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const result2 = await requireAdmin({ context: "api", redirectToMfa: false });
    if (result2 instanceof Response) return result2;
    const { user, supabase } = result2;

    const body = await req.json();
    const result = TestConfigSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error.flatten() }, { status: 422 });
    }

    const { data, error } = await supabase
      .from("tests")
      .insert({ ...result.data, created_by: user.id })
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (err: any) {
    if (err.message === "MFA_REQUIRED") return NextResponse.json({ error: "MFA Required" }, { status: 403 });
    if (err.message === "NOT_FOUND") return NextResponse.json({ error: "Not Found" }, { status: 404 });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
