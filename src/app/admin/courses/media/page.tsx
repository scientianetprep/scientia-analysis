import "server-only";

import { requireAdmin } from "@/lib/supabase/require-admin";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export const metadata = { title: "Media Library — Admin" };
export const dynamic = "force-dynamic";

export default async function AdminMediaLibraryPage() {
  await requireAdmin();
  const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const [{ data: courses }, { data: lessons }] = await Promise.all([
    adminClient.from("courses").select("id, title, thumbnail_url, created_at").order("created_at", { ascending: false }),
    adminClient.from("lessons").select("id, course_id, title, content_type, content_body, created_at").order("created_at", { ascending: false }),
  ]);

  const mediaRows = [
    ...(courses || [])
      .filter((c) => c.thumbnail_url)
      .map((c) => ({
        id: `course-${c.id}`,
        type: "image",
        name: `${c.title} thumbnail`,
        url: c.thumbnail_url,
        course_id: c.id,
        source: "course",
        created_at: c.created_at,
      })),
    ...(lessons || [])
      .filter((l) => l.content_type === "video" || l.content_type === "pdf")
      .map((l) => ({
        id: `lesson-${l.id}`,
        type: l.content_type,
        name: l.title,
        url: l.content_body,
        course_id: l.course_id,
        source: "lesson",
        created_at: l.created_at,
      })),
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-poppins font-semibold text-on-surface tracking-tight">
          Media library
        </h1>
        <p className="text-sm text-on-surface-variant">
          Index of course thumbnails and lesson media · {mediaRows.length} assets
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
        {mediaRows.map((row) => (
          <div key={row.id} className="surface-card p-3">
            <div className="flex items-center justify-between text-[10px] text-outline">
              <span className="uppercase">{row.type}</span>
              <span>{row.source}</span>
            </div>
            <p className="text-sm font-medium text-on-surface mt-1 line-clamp-1">{row.name}</p>
            <p className="text-[11px] text-outline mt-0.5 line-clamp-2 break-all">{row.url}</p>
          </div>
        ))}
        {mediaRows.length === 0 && (
          <div className="col-span-full surface-card p-6 text-center text-sm text-outline">
            No media assets yet.
          </div>
        )}
      </div>
    </div>
  );
}
