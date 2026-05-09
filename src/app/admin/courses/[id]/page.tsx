import { requireAdmin } from "@/lib/supabase/require-admin";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { CourseDetailClient } from "./course-detail-client";
import { notFound } from "next/navigation";

export const metadata = { title: "Manage Course — Admin" };
export const dynamic = "force-dynamic";

export default async function AdminCourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  // Fetch course and its lessons
  const { data: course, error } = await supabase
    .from("courses")
    .select("*, lessons(*)")
    .eq("id", id)
    .order("sequence_order", { foreignTable: "lessons", ascending: true })
    .single();

  if (error || !course) {
    return notFound();
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <CourseDetailClient initialCourse={course} />
    </div>
  );
}
