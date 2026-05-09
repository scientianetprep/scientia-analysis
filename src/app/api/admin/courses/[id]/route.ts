import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createServerClientFn } from "@/lib/supabase/server";

// Same Router-Cache bust as /api/admin/courses — any PUT (publish toggle,
// thumbnail, rename, archive, access_tier) or DELETE must also refresh both
// the admin list and the student-facing lists.
function invalidateCourseSurfaces(id: string) {
  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${id}`);
  revalidatePath("/admin");
  revalidatePath("/dashboard/courses");
  revalidatePath(`/dashboard/courses/${id}`);
  revalidatePath("/dashboard");
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin({ context: "api" });
    const { id } = await params;
    const supabase = await createServerClientFn();
    const { data: course, error } = await supabase
      .from("courses")
      .select("*, lessons(*), course_settings(*)")
      .eq("id", id)
      .order("sequence_order", { foreignTable: "lessons", ascending: true })
      .single();

    if (error) throw error;
    return NextResponse.json(course);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin({ context: "api" });
    const { id } = await params;
    const updates = await req.json();
    const supabase = await createServerClientFn();

    const status =
      updates.status ||
      (typeof updates.is_published === "boolean" ? (updates.is_published ? "published" : "draft") : undefined);
    const courseUpdates = { ...updates, ...(status ? { status } : {}) };

    const { data, error } = await supabase
      .from("courses")
      .update(courseUpdates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    invalidateCourseSurfaces(id);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin({ context: "api" });
    const { id } = await params;
    const supabase = await createServerClientFn();

    const { data: grants } = await supabase
      .from("course_access_grants")
      .select("id")
      .eq("course_id", id)
      .eq("is_active", true)
      .limit(1);
    if ((grants || []).length > 0) {
      return NextResponse.json(
        { error: "Cannot delete course with enrolled students. Unenroll or migrate students first." },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("courses")
      .update({ deleted_at: new Date().toISOString(), status: "archived", is_published: false })
      .eq("id", id);

    if (error) throw error;
    invalidateCourseSurfaces(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
