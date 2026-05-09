import "server-only";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { NewCourseForm } from "./new-course-form";

export const metadata = { title: "New Course — Admin" };
export const dynamic = "force-dynamic";

export default async function NewCoursePage() {
  await requireAdmin();

  return <NewCourseForm />;
}
