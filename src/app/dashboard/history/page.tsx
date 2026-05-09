"use client";

import { createBrowserClient } from "@/lib/supabase/client";
import {
  Trophy,
  BookOpen,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { HistoryListSkeleton } from "@/components/dashboard/Skeletons";

interface TestResult {
  id: string;
  test_id: string;
  correct_count: number;
  total_count: number;
  percentage: number;
  created_at: string;
  tests: {
    name: string;
    subject: string;
  };
}

interface LessonCompletion {
  id: string;
  lesson_id: string;
  created_at: string;
  lessons: {
    title: string;
    courses: {
      name: string;
    };
  };
}

export default function HistoryPage() {
  const [scores, setScores] = useState<TestResult[]>([]);
  const [completions, setCompletions] = useState<LessonCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"scores" | "lessons">("scores");
  const [searchQuery, setSearchQuery] = useState("");

  const supabase = createBrowserClient();

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [scoresRes, completionsRes] = await Promise.all([
        supabase
          .from("scores")
          .select("*, tests(name, subject)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("lesson_completions")
          .select("*, lessons(title, courses(name))")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
      ]);

      setScores(scoresRes.data || []);
      setCompletions(completionsRes.data || []);
      setLoading(false);
    }
    fetchData();
  }, [supabase]);

  const filteredScores = scores.filter(s =>
    s.tests?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.tests?.subject?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredLessons = completions.filter(l =>
    l.lessons?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.lessons?.courses?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-outline hover:text-tertiary transition-colors mb-2"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Back
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-poppins font-semibold text-on-surface tracking-tight">
              Academic history
            </h1>
            <p className="text-sm text-on-surface-variant">
              Your tests and lesson completions.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
            <input
              type="text"
              placeholder="Search…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-8 pr-3 rounded-md bg-surface-container-high border border-outline-variant/20 focus:border-tertiary focus:ring-1 focus:ring-tertiary outline-none text-sm"
            />
          </div>
        </div>
      </div>

      <div className="inline-flex rounded-md bg-surface-container-high border border-outline-variant/15 p-0.5">
        <button
          onClick={() => setActiveTab("scores")}
          className={cn(
            "h-8 px-3 rounded-[5px] text-xs font-medium inline-flex items-center gap-1.5 transition-colors",
            activeTab === "scores"
              ? "bg-tertiary text-white"
              : "text-outline hover:text-on-surface"
          )}
        >
          <Trophy className="w-3.5 h-3.5" /> Test scores
        </button>
        <button
          onClick={() => setActiveTab("lessons")}
          className={cn(
            "h-8 px-3 rounded-[5px] text-xs font-medium inline-flex items-center gap-1.5 transition-colors",
            activeTab === "lessons"
              ? "bg-tertiary text-white"
              : "text-outline hover:text-on-surface"
          )}
        >
          <BookOpen className="w-3.5 h-3.5" /> Lessons
        </button>
      </div>

      {loading ? (
        <HistoryListSkeleton count={6} />
      ) : (
        <div className="surface-card overflow-hidden">
          <ul className="divide-y divide-outline-variant/10">
            {activeTab === "scores" ? (
              filteredScores.length > 0 ? (
                filteredScores.map((score) => (
                  <li key={score.id} id={score.id}>
                    <Link
                      href={`/dashboard/tests/results/${score.id}`}
                      className="flex items-center gap-3 px-3 h-12 hover:bg-surface-container-high transition-colors"
                    >
                      <div
                        className={cn(
                          "w-10 h-9 rounded-md shrink-0 grid place-items-center text-[11px] font-poppins font-semibold tabular-nums",
                          score.percentage >= 80
                            ? "bg-green-500/10 text-green-600"
                            : score.percentage >= 50
                            ? "bg-orange-500/10 text-orange-600"
                            : "bg-red-500/10 text-red-600"
                        )}
                      >
                        {Math.round(score.percentage)}%
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-on-surface truncate">
                          {score.tests?.name}
                        </div>
                        <div className="text-xs text-outline flex items-center gap-1.5">
                          <span className="truncate">{score.tests?.subject}</span>
                          <span>•</span>
                          <span>{fmt(score.created_at)}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-outline shrink-0" />
                    </Link>
                  </li>
                ))
              ) : (
                <EmptyState
                  icon={<Trophy className="w-6 h-6" />}
                  title={searchQuery ? "No results" : "No scores yet"}
                  description={
                    searchQuery
                      ? `Nothing matching "${searchQuery}"`
                      : "Attempt a test to see your progress here."
                  }
                />
              )
            ) : filteredLessons.length > 0 ? (
              filteredLessons.map((completion) => (
                <li key={completion.id}>
                  <Link
                    href={`/dashboard/courses/${completion.lesson_id}`}
                    className="flex items-center gap-3 px-3 h-12 hover:bg-surface-container-high transition-colors"
                  >
                    <div className="w-9 h-9 rounded-md shrink-0 bg-brand-primary/10 grid place-items-center">
                      <BookOpen className="w-4 h-4 text-brand-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-on-surface truncate">
                        {completion.lessons?.title}
                      </div>
                      <div className="text-xs text-outline flex items-center gap-1.5">
                        <span className="truncate">
                          {completion.lessons?.courses?.name}
                        </span>
                        <span>•</span>
                        <span>{fmt(completion.created_at)}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-outline shrink-0" />
                  </Link>
                </li>
              ))
            ) : (
              <EmptyState
                icon={<BookOpen className="w-6 h-6" />}
                title={searchQuery ? "No results" : "No lessons yet"}
                description={
                  searchQuery
                    ? `Nothing matching "${searchQuery}"`
                    : "Complete a lesson to begin your transcript."
                }
              />
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <li className="px-4 py-12 flex flex-col items-center justify-center text-center">
      <div className="w-10 h-10 rounded-md bg-surface-container-high grid place-items-center text-outline mb-2">
        {icon}
      </div>
      <div className="text-sm font-medium text-on-surface">{title}</div>
      <div className="text-xs text-outline mt-0.5 max-w-xs">{description}</div>
    </li>
  );
}
