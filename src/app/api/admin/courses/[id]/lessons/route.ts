import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createServerClientFn } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin({ context: "api" });
    const { id: courseId } = await params;
    const { title, content_type, content_body, sequence_order, is_published } = await req.json();

    if (!title || !content_type) {
      return NextResponse.json({ error: "Missing title or content type" }, { status: 400 });
    }

    const supabase = await createServerClientFn();
    const { data, error } = await supabase
      .from("lessons")
      .insert({
        course_id: courseId,
        title,
        content_type,
        content_body: content_body || "",
        sequence_order: sequence_order || 0,
        is_published: is_published || false,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
