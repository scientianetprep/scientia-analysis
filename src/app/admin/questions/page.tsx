import "server-only";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { QuestionsClient } from "./questions-client";

export const metadata = { title: "Questions — Admin" };
export const revalidate = 3600; // ISR: revalidate every hour
export const dynamic = "force-dynamic";

export default async function AdminQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; subject?: string }>;
}) {
  await requireAdmin();
  const { page = "1", subject } = await searchParams;
  const pageNum = Math.max(1, parseInt(page));
  const pageSize = 50;
  const from = (pageNum - 1) * pageSize;

  const adminClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  );

  let query = adminClient
    .from("questions")
    .select("*", { count: "exact" })
    .neq("status", "retired");

  if (subject) query = query.eq("subject", subject);

  query = query
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  const { data: questions, count } = await query;
  const totalPages = Math.ceil((count || 0) / pageSize);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-poppins font-semibold text-on-surface tracking-tight">
          Questions
        </h1>
        <p className="text-sm text-on-surface-variant">
          Manage the question bank. LaTeX preview supported. {count ?? 0} total.
        </p>
      </div>

      <QuestionsClient
        key={`${pageNum}-${subject || "all"}`}
        initialQuestions={questions || []}
        totalPages={totalPages}
        currentPage={pageNum}
        totalCount={count || 0}
      />
    </div>
  );
}
