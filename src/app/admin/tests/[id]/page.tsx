import { redirect } from "next/navigation";

/**
 * Root-cause fix for bug #8: clicking a test row in the admin list previously
 * routed to `/admin/tests/[id]` which had no page.tsx, yielding a 404. The
 * edit UI lives at `/admin/tests/[id]/edit`, so this route exists solely to
 * forward any direct link or accidental navigation to the editor.
 */
export default async function AdminTestRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/tests/${id}/edit`);
}
