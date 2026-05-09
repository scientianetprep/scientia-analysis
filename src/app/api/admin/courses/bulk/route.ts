import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// Same Router-Cache bust as the single-course routes. Without it, bulk
// publish/unpublish/archive from the admin list doesn't show up for either
// admins (on the next list load) or students (on /dashboard/courses).
function invalidateCourseSurfaces() {
  revalidatePath("/admin/courses");
  revalidatePath("/admin");
  revalidatePath("/dashboard/courses");
  revalidatePath("/dashboard");
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin({ context: "api" });
    const { action, courseIds, targetCourseId } = await req.json();
    if (!Array.isArray(courseIds) || courseIds.length === 0) {
      return NextResponse.json({ error: "courseIds are required" }, { status: 400 });
    }

    const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    if (action === "publish") {
      const { error } = await adminClient.from("courses").update({ status: "published", is_published: true }).in("id", courseIds);
      if (error) throw error;
      invalidateCourseSurfaces();
      return NextResponse.json({ success: true });
    }

    if (action === "unpublish") {
      const { error } = await adminClient.from("courses").update({ status: "draft", is_published: false }).in("id", courseIds);
      if (error) throw error;
      invalidateCourseSurfaces();
      return NextResponse.json({ success: true });
    }

    if (action === "archive") {
      const { error } = await adminClient.from("courses").update({ status: "archived", is_published: false }).in("id", courseIds);
      if (error) throw error;
      invalidateCourseSurfaces();
      return NextResponse.json({ success: true });
    }

    if (action === "delete") {
      const { data: grants } = await adminClient.from("course_access_grants").select("course_id").in("course_id", courseIds).eq("is_active", true);
      if ((grants || []).length > 0) {
        return NextResponse.json({ error: "Some selected courses still have enrolled students" }, { status: 400 });
      }
      const { error } = await adminClient
        .from("courses")
        .update({ status: "archived", is_published: false, deleted_at: new Date().toISOString() })
        .in("id", courseIds);
      if (error) throw error;
      invalidateCourseSurfaces();
      return NextResponse.json({ success: true });
    }

    if (action === "move_lessons") {
      if (!targetCourseId) return NextResponse.json({ error: "targetCourseId required" }, { status: 400 });
      const { error } = await adminClient.from("lessons").update({ course_id: targetCourseId }).in("course_id", courseIds);
      if (error) throw error;
      invalidateCourseSurfaces();
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

