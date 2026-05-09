/**
 * Centralized cached data fetchers for Courses
 * 
 * All course queries go through this layer for:
 * - Consistent caching with revalidateTag
 * - Avoiding duplicate queries across components
 * - Server-side execution (no client JS overhead)
 */

import { createServerClientFn } from "@/lib/supabase/server";

export async function fetchCourses() {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("courses")
    .select("*, lessons(id, title, is_published)")
    .is("deleted_at", null)
    .neq("status", "archived")
    .order("created_at", { ascending: false });

  if (error) throw error;
  cacheTag("courses");
  return data ?? [];
}

export async function fetchCourseById(id: string) {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("courses")
    .select("*, lessons(*), course_settings(*)")
    .eq("id", id)
    .single();

  if (error) throw error;
  cacheTag("courses", `course-${id}`);
  return data;
}

export async function fetchPublishedCourses() {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("courses")
    .select("id, title, slug, subject, description, category, thumbnail_url, level")
    .eq("is_published", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  cacheTag("courses");
  return data ?? [];
}

export async function fetchUserCourses(userId: string) {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("user_courses")
    .select("*, courses(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  cacheTag("courses", `user-courses-${userId}`);
  return data ?? [];
}
