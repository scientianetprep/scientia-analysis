import "server-only";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { notFound } from "next/navigation";
import { TestBuilderForm } from "@/components/admin/TestBuilderForm";

export const metadata = { title: "Edit Test — Admin" };
export const dynamic = "force-dynamic";

// Folder is `[id]/edit`, so Next.js passes the segment as `params.id`. The
// original code destructured `params.testId` which is *always* undefined,
// and `.eq("id", undefined)` returns zero rows → notFound() → 404 on every
// Edit click (reported bug #8). Bind `testId` to the actual `id` segment.
interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminEditTestPage({ params }: PageProps) {
  await requireAdmin();
  const { id: testId } = await params;

  const adminClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: test } = await adminClient
    .from("tests")
    .select("*")
    .eq("id", testId)
    .single();

  if (!test) notFound();

  return (
    <div className="animate-fade-in">
      <TestBuilderForm initial={{ ...test }} />
    </div>
  );
}
