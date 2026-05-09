import "server-only";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import Link from "next/link";
import { Plus, PenTool, Eye, EyeOff, Clock } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { DeleteTestButton } from "./DeleteTestButton";

export const metadata = { title: "Test Builder — Admin" };
export const revalidate = 3600; // ISR: revalidate every hour
export const dynamic = "force-dynamic";

export default async function AdminTestsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; subject?: string; status?: string }>;
}) {
  await requireAdmin();
  const { page = "1", subject, status } = await searchParams;
  const pageNum = Math.max(1, parseInt(page));
  const pageSize = 20;
  const from = (pageNum - 1) * pageSize;

  const adminClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  );

  let query = adminClient
    .from("tests")
    .select("id, name, subject, is_published, is_mock, time_limit, question_ids, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (subject) query = query.eq("subject", subject);
  if (status === "published") query = query.eq("is_published", true);
  if (status === "draft") query = query.eq("is_published", false);

  const { data: tests, count } = await query;
  const totalPages = Math.ceil((count || 0) / pageSize);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-poppins font-semibold text-on-surface tracking-tight">
            Tests
          </h1>
          <p className="text-sm text-on-surface-variant">
            Create, edit, and publish exam tests. {count ?? 0} total.
          </p>
        </div>
        <Link
          href="/admin/tests/new"
          className="h-9 px-3 rounded-md bg-tertiary text-white font-poppins font-medium text-sm hover:bg-tertiary/90 transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          New test
        </Link>
      </div>

      {/* Filters */}
      <div className="surface-card p-2.5 flex flex-wrap gap-1.5 items-center">
        <div className="flex flex-wrap gap-1">
          {["all", "Physics", "Chemistry", "Math", "Biology", "English"].map((s) => (
            <Link
              key={s}
              href={s === "all" ? "/admin/tests" : `/admin/tests?subject=${s}`}
              className={cn(
                "h-7 px-2.5 rounded-md text-xs font-medium transition-colors flex items-center",
                (!subject && s === "all") || subject === s
                  ? "bg-tertiary text-white"
                  : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
              )}
            >
              {s === "all" ? "All" : s}
            </Link>
          ))}
        </div>
        <div className="ml-auto flex gap-1">
          {[
            { label: "All", value: undefined },
            { label: "Published", value: "published" },
            { label: "Draft", value: "draft" },
          ].map(({ label, value }) => (
            <Link
              key={label}
              href={value ? `/admin/tests?status=${value}${subject ? `&subject=${subject}` : ""}` : "/admin/tests"}
              className={cn(
                "h-7 px-2.5 rounded-md text-xs font-medium transition-colors flex items-center",
                status === value || (!status && !value)
                  ? "bg-on-surface/10 text-on-surface"
                  : "text-outline hover:text-on-surface"
              )}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block surface-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-container-high/60 text-xs text-outline">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium">Name</th>
              <th className="px-3 py-2.5 text-left font-medium">Subject</th>
              <th className="px-3 py-2.5 text-left font-medium">Qs</th>
              <th className="px-3 py-2.5 text-left font-medium">Time</th>
              <th className="px-3 py-2.5 text-left font-medium">Status</th>
              <th className="px-3 py-2.5 text-left font-medium">Created</th>
              <th className="px-3 py-2.5 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            {(tests || []).map((test: any) => (
              <tr key={test.id} className="h-11 hover:bg-surface-container-high/40">
                <td className="px-3">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-on-surface truncate max-w-[320px]">{test.name}</span>
                    {test.is_mock && (
                      <span className="inline-flex items-center h-5 px-1.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-500">Mock</span>
                    )}
                  </div>
                </td>
                <td className="px-3 text-on-surface-variant">{test.subject}</td>
                <td className="px-3 text-on-surface-variant tabular-nums">{test.question_ids?.length ?? 0}</td>
                <td className="px-3 text-on-surface-variant">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {test.time_limit}m
                  </span>
                </td>
                <td className="px-3">
                  <span className={cn(
                    "inline-flex items-center gap-1 h-5 px-1.5 rounded text-[10px] font-medium",
                    test.is_published
                      ? "bg-green-500/10 text-green-600"
                      : "bg-amber-500/10 text-amber-600"
                  )}>
                    {test.is_published ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    {test.is_published ? "Published" : "Draft"}
                  </span>
                </td>
                <td className="px-3 text-outline text-xs">
                  {format(new Date(test.created_at), "MMM d, yyyy")}
                </td>
                <td className="px-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Link
                      href={`/admin/tests/${test.id}/edit`}
                      className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-surface-container-high border border-outline-variant/20 text-xs hover:bg-surface-container-highest"
                    >
                      <PenTool className="w-3 h-3" />
                      Edit
                    </Link>
                    <DeleteTestButton testId={test.id} testName={test.name} />
                  </div>
                </td>
              </tr>
            ))}
            {!tests?.length && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-outline">
                  No tests found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {(tests || []).map((test: any) => (
          <div key={test.id} className="surface-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium text-on-surface truncate">{test.name}</span>
                  {test.is_mock && (
                    <span className="inline-flex items-center h-5 px-1.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-500">Mock</span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] text-on-surface-variant">
                  <span>{test.subject}</span>
                  <span>{test.question_ids?.length ?? 0} Qs</span>
                  <span>{test.time_limit}m</span>
                  <span className={test.is_published ? "text-green-600" : "text-amber-600"}>
                    {test.is_published ? "Published" : "Draft"}
                  </span>
                  <span>{format(new Date(test.created_at), "MMM d, yyyy")}</span>
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-1.5">
                <Link
                  href={`/admin/tests/${test.id}/edit`}
                  className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-surface-container-high border border-outline-variant/20 text-xs"
                >
                  <PenTool className="w-3 h-3" />
                  Edit
                </Link>
                <DeleteTestButton testId={test.id} testName={test.name} />
              </div>
            </div>
          </div>
        ))}
        {!tests?.length && (
          <div className="surface-card p-6 text-center text-sm text-outline">No tests found.</div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs">
          <p className="text-outline">
            Page {pageNum} of {totalPages} · {count} tests
          </p>
          <div className="flex gap-1.5">
            {pageNum > 1 && (
              <Link
                href={`/admin/tests?page=${pageNum - 1}${subject ? `&subject=${subject}` : ""}${status ? `&status=${status}` : ""}`}
                className="h-8 px-2.5 rounded-md bg-surface-container-high border border-outline-variant/20 text-on-surface flex items-center"
              >
                Prev
              </Link>
            )}
            {pageNum < totalPages && (
              <Link
                href={`/admin/tests?page=${pageNum + 1}${subject ? `&subject=${subject}` : ""}${status ? `&status=${status}` : ""}`}
                className="h-8 px-2.5 rounded-md bg-tertiary text-white flex items-center"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
