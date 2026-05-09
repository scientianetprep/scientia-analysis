import "server-only";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { CoursesClient } from "./courses-client";

export const metadata = { title: "Courses — Admin" };
export const revalidate = 3600; // ISR: revalidate every hour

export default async function AdminCoursesPage() {
  await requireAdmin();
  
  const adminClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Run the two relational counts as separate queries instead of a single
  // PostgREST embed. The embed form silently returns `data: null` any time
  // the relationship can't be resolved (e.g. after a missing FK — see
  // migration 020 for the historical bug). Two explicit queries are cheap,
  // always readable, and give us a much better error trail.
  const [{ data: courses, error: coursesErr }, { data: lessonsCnt }, { data: grantsCnt }] =
    await Promise.all([
      adminClient
        .from("courses")
        .select("*")
        .order("created_at", { ascending: false }),
      adminClient.from("lessons").select("id, course_id"),
      adminClient.from("course_access_grants").select("id, course_id").eq("is_active", true),
    ]);

  if (coursesErr) {
    // eslint-disable-next-line no-console
    console.error("[admin/courses] courses query failed:", coursesErr.message);
  }

  // Fold the count rows onto each course so `CoursesClient` can keep its
  // existing `course.lessons?.length` / `course.course_access_grants?.length`
  // render path untouched.
  const lessonsByCourse = new Map<string, { id: string }[]>();
  for (const l of lessonsCnt ?? []) {
    const arr = lessonsByCourse.get((l as any).course_id) ?? [];
    arr.push({ id: (l as any).id });
    lessonsByCourse.set((l as any).course_id, arr);
  }
  const grantsByCourse = new Map<string, { id: string }[]>();
  for (const g of grantsCnt ?? []) {
    const arr = grantsByCourse.get((g as any).course_id) ?? [];
    arr.push({ id: (g as any).id });
    grantsByCourse.set((g as any).course_id, arr);
  }
  const coursesWithCounts = (courses ?? []).map((c: any) => ({
    ...c,
    lessons: lessonsByCourse.get(c.id) ?? [],
    course_access_grants: grantsByCourse.get(c.id) ?? [],
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-poppins font-semibold text-on-surface tracking-tight">
          Courses
        </h1>
        <p className="text-sm text-on-surface-variant">
          Manage courses, lessons, and media.
        </p>
      </div>

      <CoursesClient initialCourses={coursesWithCounts} />
    </div>
  );
}
