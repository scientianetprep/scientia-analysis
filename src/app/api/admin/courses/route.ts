import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// Wipe the Next 16 Router Cache entries that display courses so a freshly
// created/edited/deleted course appears the next time the user navigates to
// the list — without this, `router.push` from /admin/courses/new returns the
// user to a cached RSC payload that predates the insert (root cause of "added
// but never show up"). Both admin list and the student dashboard need it.
function invalidateCourseSurfaces() {
  revalidatePath("/admin/courses");
  revalidatePath("/admin");
  revalidatePath("/dashboard/courses");
  revalidatePath("/dashboard");
}

export async function GET() {
  try {
    await requireAdmin({ context: "api" });
    const adminClient = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data: courses, error } = await adminClient
      .from("courses")
      .select("*, lessons(id)")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json(courses);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin({ context: "api" });
    const { title, subject, description, is_published, slug } = await req.json();

    if (!title || !subject) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const adminClient = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY
    );
    const generatedSlug =
      slug ||
      String(title)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");

    const { data, error } = await adminClient
      .from("courses")
      .insert({
        title,
        slug: generatedSlug,
        subject,
        description,
        short_description: description?.slice(0, 160) || null,
        is_published: is_published || false,
        status: is_published ? "published" : "draft",
      })
      .select()
      .single();

    if (error) throw error;
    await adminClient.from("course_settings").upsert({ course_id: data.id }, { onConflict: "course_id" });
    invalidateCourseSurfaces();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
