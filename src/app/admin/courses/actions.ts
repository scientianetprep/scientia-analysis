"use server";

import { createServerClientFn } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { invalidateCourses } from "@/lib/cache/invalidate";

/**
 * Server Actions for course management
 * These replace individual API routes and reduce Function Invocations
 * by bundling mutations with the page code.
 */

export async function createCourseAction(formData: FormData) {
  await requireAdmin({ context: "api" });

  const title = formData.get("title") as string;
  const subject = formData.get("subject") as string;
  const description = formData.get("description") as string;

  const supabase = await createServerClientFn();

  const { data, error } = await supabase
    .from("courses")
    .insert([
      {
        title,
        subject,
        description,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      },
    ])
    .select()
    .single();

  if (error) throw error;

  invalidateCourses();
  return data;
}

export async function updateCourseAction(courseId: string, formData: FormData) {
  await requireAdmin({ context: "api" });

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;

  const supabase = await createServerClientFn();

  const { data, error } = await supabase
    .from("courses")
    .update({
      title,
      description,
      updated_at: new Date().toISOString(),
    })
    .eq("id", courseId)
    .select()
    .single();

  if (error) throw error;

  invalidateCourses();
  return data;
}

export async function deleteCourseAction(courseId: string) {
  await requireAdmin({ context: "api" });

  const supabase = await createServerClientFn();

  const { error } = await supabase
    .from("courses")
    .update({
      deleted_at: new Date().toISOString(),
      status: "deleted",
    })
    .eq("id", courseId);

  if (error) throw error;

  invalidateCourses();
}

export async function publishCourseAction(courseId: string) {
  await requireAdmin({ context: "api" });

  const supabase = await createServerClientFn();

  const { error } = await supabase
    .from("courses")
    .update({ is_published: true, status: "published" })
    .eq("id", courseId);

  if (error) throw error;

  invalidateCourses();
}
