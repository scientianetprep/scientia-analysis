"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Search, Plus, Image as ImageIcon } from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";

type Question = {
  id: string;
  text: string;
  subject: string;
  topic?: string;
  difficulty?: string;
  status: string;
  usage_count: number;
  bloom_level?: string;
  image_url?: string | null;
};

type Props = {
  questions: Question[];
  total: number;
  filters: Record<string, string | undefined>;
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "bg-green-500/10 text-green-500",
  medium: "bg-yellow-500/10 text-yellow-500",
  hard: "bg-red-500/10 text-red-500",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-outline/10 text-outline",
  review: "bg-yellow-500/10 text-yellow-500",
  approved: "bg-green-500/10 text-green-500",
  retired: "bg-red-500/10 text-red-500",
};

const SUBJECTS = ["Physics", "Chemistry", "Math", "English", "Biology"];

export function QuestionBankTable({ questions, total, filters }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(filters.q ?? "");

  function applyFilter(key: string, val: string) {
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => !!v) as [string, string][]
    );
    if (val) params.set(key, val);
    else params.delete(key);
    router.push(`/admin/questions?${params}`);
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-poppins font-semibold tracking-tight text-on-surface">
            Question bank
          </h1>
          <p className="text-xs text-outline mt-0.5 tabular-nums">
            {total} questions total
          </p>
        </div>
        <Link
          href="/admin/questions"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-tertiary text-white text-xs font-poppins font-medium hover:bg-tertiary/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New question
        </Link>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-outline" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilter("q", search)}
            placeholder="Search question text… (Enter to apply)"
            className="w-full h-9 pl-8 pr-3 rounded-md bg-surface-container-high border border-outline-variant/20 text-xs outline-none focus:border-tertiary focus:ring-1 focus:ring-tertiary transition-colors"
          />
        </div>

        <select
          value={filters.subject ?? ""}
          onChange={(e) => applyFilter("subject", e.target.value)}
          className="h-9 px-2.5 rounded-md bg-surface-container-high border border-outline-variant/20 text-xs outline-none focus:border-tertiary"
        >
          <option value="">All subjects</option>
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={filters.difficulty ?? ""}
          onChange={(e) => applyFilter("difficulty", e.target.value)}
          className="h-9 px-2.5 rounded-md bg-surface-container-high border border-outline-variant/20 text-xs outline-none focus:border-tertiary"
        >
          <option value="">All difficulties</option>
          {["easy", "medium", "hard"].map((d) => (
            <option key={d} value={d} className="capitalize">
              {d}
            </option>
          ))}
        </select>

        <select
          value={filters.status ?? ""}
          onChange={(e) => applyFilter("status", e.target.value)}
          className="h-9 px-2.5 rounded-md bg-surface-container-high border border-outline-variant/20 text-xs outline-none focus:border-tertiary"
        >
          <option value="">All statuses</option>
          {["draft", "review", "approved", "retired"].map((s) => (
            <option key={s} value={s} className="capitalize">
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-surface-container-high border-b border-outline-variant/15">
              <tr>
                {["Question", "Subject", "Difficulty", "Bloom", "Status", "Usage", ""].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left text-[11px] font-poppins font-medium text-outline whitespace-nowrap"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {questions.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-8 text-center text-on-surface-variant"
                  >
                    No questions found. Start by creating one above.
                  </td>
                </tr>
              ) : (
                questions.map((q) => (
                  <tr
                    key={q.id}
                    className="hover:bg-surface-container-low transition-colors"
                  >
                    <td className="px-3 py-2.5 max-w-xs">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-on-surface line-clamp-2 prose prose-sm max-w-none prose-slate">
                            <MarkdownRenderer content={q.text} />
                          </div>
                          {q.topic && (
                            <p className="text-[11px] text-outline mt-0.5">
                              {q.topic}
                            </p>
                          )}
                          {/* Option preview to ensure LaTeX is rendered */}
                          <div className="mt-2 flex flex-wrap gap-2">
                            {(["a", "b", "c", "d"] as const).map(l => (
                              <div key={l} className="flex items-center gap-1 bg-surface-container-highest/30 px-1.5 py-0.5 rounded border border-outline-variant/10">
                                <span className="text-[9px] font-bold text-outline uppercase">{l}</span>
                                <div className="text-[10px] text-on-surface-variant prose prose-sm max-w-none dark:prose-invert">
                                  <MarkdownRenderer content={(q as any)[`option_${l}`] || ""} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        {q.image_url && (
                          <div className="shrink-0 w-8 h-8 rounded bg-surface-container-highest border border-outline-variant/20 flex items-center justify-center overflow-hidden" title="Has illustration">
                            <img src={q.image_url} alt="" className="w-full h-full object-cover opacity-50" />
                            <ImageIcon className="absolute w-3.5 h-3.5 text-tertiary" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-on-surface-variant whitespace-nowrap">
                      {q.subject}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded-full text-[11px] font-medium capitalize",
                          q.difficulty
                            ? DIFFICULTY_COLORS[q.difficulty] ??
                                "bg-outline/10 text-outline"
                            : "bg-outline/10 text-outline"
                        )}
                      >
                        {q.difficulty ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-on-surface-variant capitalize">
                      {q.bloom_level ?? "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded-full text-[11px] font-medium capitalize",
                          STATUS_COLORS[q.status] ?? "bg-outline/10 text-outline"
                        )}
                      >
                        {q.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-on-surface-variant tabular-nums text-center">
                      {q.usage_count ?? 0}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <Link
                        href={`/admin/questions/${q.id}/edit`}
                        className="text-[11px] font-poppins font-medium text-tertiary hover:underline"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
