import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createServerClientFn } from "@/lib/supabase/server";

// GET list (unchanged behaviour, just same handler as before).
export async function GET() {
  try {
    await requireAdmin({ context: "api" });
    const supabase = await createServerClientFn();
    const { data: grants, error } = await supabase
      .from("course_access_grants")
      .select(
        "*, profiles!course_access_grants_user_profile_fkey(full_name, email), courses(title)"
      )
      .order("granted_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json(grants);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — create (or re-activate) a grant for a (user_id, course_id) pair.
// Previously admins had no UI path to create grants — the access page only
// listed existing rows and let you toggle them. That meant a brand-new
// "restricted" or "private" course was effectively unreachable for any
// student. This handler lets the Grant access modal on /admin/courses/access
// and the upcoming course-detail Access tab actually enroll students.
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin({ context: "api" });
    const supabase = await createServerClientFn();

    const body = await req.json().catch(() => ({} as any));
    const user_id = String(body.user_id || "").trim();
    const course_id = String(body.course_id || "").trim();
    const access_tier = String(body.access_tier || "all").trim();

    if (!user_id || !course_id) {
      return NextResponse.json(
        { error: "user_id and course_id are required" },
        { status: 400 }
      );
    }
    if (!["free", "basic", "premium", "all"].includes(access_tier)) {
      return NextResponse.json(
        { error: "access_tier must be one of free | basic | premium | all" },
        { status: 400 }
      );
    }

    // Short-circuit the common "student already enrolled" case so the UI
    // can surface it without looking like a hard failure.
    const { data: existing } = await supabase
      .from("course_access_grants")
      .select("id, is_active")
      .eq("user_id", user_id)
      .eq("course_id", course_id)
      .maybeSingle();

    if (existing) {
      // If it's a previously-revoked row, re-activate it in place so we
      // don't accumulate duplicates and admins get a clean audit trail.
      if (!existing.is_active) {
        const { data: reactivated, error: upErr } = await supabase
          .from("course_access_grants")
          .update({
            is_active: true,
            revoked_at: null,
            access_tier,
            granted_by: (admin as any).id ?? null,
            granted_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select(
            "*, profiles!course_access_grants_user_profile_fkey(full_name, email), courses(title)"
          )
          .single();
        if (upErr) throw upErr;
        revalidatePath("/admin/courses/access");
        revalidatePath("/dashboard/courses");
        return NextResponse.json(reactivated);
      }
      return NextResponse.json(
        { error: "Student is already enrolled in this course" },
        { status: 409 }
      );
    }

    const { data: inserted, error } = await supabase
      .from("course_access_grants")
      .insert({
        user_id,
        course_id,
        access_tier,
        is_active: true,
        granted_by: (admin as any).id ?? null,
      })
      .select(
        "*, profiles!course_access_grants_user_profile_fkey(full_name, email), courses(title)"
      )
      .single();

    if (error) throw error;

    revalidatePath("/admin/courses/access");
    revalidatePath("/dashboard/courses");
    return NextResponse.json(inserted);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
