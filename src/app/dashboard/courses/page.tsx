"use client";

import { createBrowserClient } from "@/lib/supabase/client";
import { BookOpen, ChevronRight, Coins, Globe, KeyRound, Layout, Lock, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { CourseGridSkeleton } from "@/components/dashboard/Skeletons";
import { Button } from "@/components/ui/button";

const SUBJECTS = ["All", "Physics", "Chemistry", "Math", "English"];

export default function CoursesPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());
  const [prices, setPrices] = useState<Record<string, { cost: number; free: boolean }>>({});
  const [unlockedCourseIds, setUnlockedCourseIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [activeSubject, setActiveSubject] = useState("All");

  const supabase = createBrowserClient();

  useEffect(() => {
    async function fetchCourses() {
      // Soft-deleted courses (deleted_at set) must never reach students,
      // even if they forgot to flip is_published. We also guard against the
      // DB `status='archived'` path for the same reason.
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const [coursesRes, grantsRes, pricesRes, unlocksRes] = await Promise.all([
        supabase
          .from("courses")
          .select("*, lessons(id, is_published)")
          .eq("is_published", true)
          .is("deleted_at", null)
          .neq("status", "archived")
          .order("created_at", { ascending: false }),
        user
          ? supabase
              .from("course_access_grants")
              .select("course_id")
              .eq("user_id", user.id)
              .eq("is_active", true)
              .is("revoked_at", null)
          : Promise.resolve({ data: [] as { course_id: string }[] }),
        supabase
          .from("content_prices")
          .select("content_id, credit_cost, is_free")
          .eq("content_type", "course"),
        user
          ? supabase
              .from("content_unlocks")
              .select("content_id")
              .eq("user_id", user.id)
              .eq("content_type", "course")
          : Promise.resolve({ data: [] as { content_id: string }[] }),
      ]);

      const enrolledSet = new Set<string>(
        ((grantsRes as any).data ?? []).map((g: any) => g.course_id as string)
      );

      // Migration 021 visibility rules (mirrors the server gate):
      //   open       - always listed
      //   restricted - listed with a Locked badge
      //   private    - only listed when the student already has a grant
      const raw = coursesRes.data || [];
      const visible = raw.filter((c: any) => {
        const v = c.visibility ?? "open";
        if (v === "private") return enrolledSet.has(c.id);
        return true;
      });

      setCourses(visible);
      setEnrolledIds(enrolledSet);

      // Build price map
      const priceMap: Record<string, { cost: number; free: boolean }> = {};
      for (const p of pricesRes.data ?? []) {
        priceMap[p.content_id] = { cost: p.credit_cost, free: p.is_free || p.credit_cost === 0 };
      }
      setPrices(priceMap);
      setUnlockedCourseIds(new Set((unlocksRes.data ?? []).map((u: any) => u.content_id)));
      setLoading(false);
    }
    fetchCourses();
  }, [supabase]);

  const filteredCourses = courses.filter(
    (course) =>
      activeSubject === "All" ||
      course.subject?.toLowerCase() === activeSubject.toLowerCase()
  );

  return (
    <div className="space-y-5 md:space-y-6 animate-fade-in">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-poppins font-semibold tracking-tight">
            Courses
          </h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Subject modules with lessons and progress.
          </p>
        </div>
        <div className="flex gap-1 overflow-x-auto no-scrollbar -mx-1 px-1">
          {SUBJECTS.map((subject) => (
            <button
              key={subject}
              onClick={() => setActiveSubject(subject)}
              className={cn(
                "h-7 px-3 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
                activeSubject === subject
                  ? "bg-tertiary text-white"
                  : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"
              )}
            >
              {subject}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <CourseGridSkeleton count={6} />
      ) : filteredCourses.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredCourses.map((course: any) => {
            // Three access states drive both the badge and the dimming:
            //   enrolled   - student has a grant; full-colour, tertiary border
            //   open       - course is open; full-colour, Open pill
            //   locked     - restricted without grant; dimmed, Lock pill
            const visibility = course.visibility ?? "open";
            const enrolled = enrolledIds.has(course.id);
            const isOpen = !enrolled && visibility === "open";
            const isLocked = !enrolled && !isOpen;
            return (
              <Link
                key={course.id}
                href={`/dashboard/courses/${course.id}`}
                className={cn(
                  "group rounded-lg border bg-surface-container-low overflow-hidden flex flex-col transition-colors",
                  enrolled
                    ? "border-tertiary/30 hover:border-tertiary/60 hover:bg-surface-container-high/30"
                    : "border-outline-variant/15 hover:border-outline/40 hover:bg-surface-container-high/30"
                )}
              >
                <div className="aspect-[16/9] bg-surface-container-high relative overflow-hidden">
                  {course.thumbnail_url ? (
                    <img
                      src={course.thumbnail_url || "/placeholder.svg"}
                      alt={course.title}
                      className={cn(
                        "w-full h-full object-cover",
                        isLocked && "opacity-75 group-hover:opacity-100 transition-opacity"
                      )}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-tertiary/15 to-brand-primary/15">
                      <BookOpen className="w-8 h-8 text-tertiary/50" />
                    </div>
                  )}
                  {course.subject && (
                    <span className="absolute top-2 left-2 h-5 px-2 rounded-full bg-black/60 backdrop-blur-sm text-[11px] font-medium text-white flex items-center">
                      {course.subject}
                    </span>
                  )}
                  {enrolled ? (
                    <span className="absolute top-2 right-2 h-5 px-2 rounded-full bg-tertiary text-white text-[11px] font-medium flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" />
                      Enrolled
                    </span>
                  ) : isOpen ? (
                    <span className="absolute top-2 right-2 h-5 px-2 rounded-full bg-green-600/90 text-white text-[11px] font-medium flex items-center gap-1">
                      <Globe className="w-2.5 h-2.5" />
                      Open
                    </span>
                  ) : (
                    <span className="absolute top-2 right-2 h-5 px-2 rounded-full bg-black/60 backdrop-blur-sm text-[11px] font-medium text-white flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" />
                      Locked
                    </span>
                  )}
                  {/* Credit price / unlocked badge */}
                  {(() => {
                    const p = prices[course.id];
                    const unlocked = unlockedCourseIds.has(course.id);
                    if (unlocked) {
                      return (
                        <span className="absolute bottom-2 right-2 h-5 px-2 rounded-full bg-blue-500/90 text-white text-[10px] font-bold flex items-center gap-1">
                          <KeyRound className="w-2.5 h-2.5" />
                          Unlocked
                        </span>
                      );
                    }
                    if (!p) return null;
                    return p.free ? (
                      <span className="absolute bottom-2 right-2 h-5 px-2 rounded-full bg-green-500/90 text-white text-[10px] font-bold flex items-center">
                        FREE
                      </span>
                    ) : (
                      <span className="absolute bottom-2 right-2 h-5 px-2 rounded-full bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold flex items-center gap-1">
                        <Coins className="w-2.5 h-2.5" />
                        {p.cost} cr
                      </span>
                    );
                  })()}
                </div>
                <div className="p-3 flex-1 flex flex-col gap-2">
                  <h3 className={cn(
                    "text-sm font-semibold line-clamp-2 transition-colors",
                    isLocked
                      ? "text-on-surface-variant group-hover:text-on-surface"
                      : "text-on-surface group-hover:text-tertiary"
                  )}>
                    {course.title}
                  </h3>
                  {course.description && (
                    <p className="text-xs text-on-surface-variant line-clamp-2">
                      {course.description}
                    </p>
                  )}
                  <div className="mt-auto flex items-center justify-between text-[11px] text-outline pt-2 border-t border-outline-variant/10">
                    <span className="flex items-center gap-1">
                      <Layout className="w-3 h-3" />
                      {course.lessons?.filter((l: any) => l.is_published).length || 0} lessons
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-outline group-hover:text-tertiary transition-colors" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-outline-variant/25 p-8 flex flex-col items-center text-center gap-3">
          <div className="w-10 h-10 rounded-md bg-surface-container-high flex items-center justify-center">
            <Search className="w-5 h-5 text-outline" />
          </div>
          <div>
            <p className="text-sm font-semibold text-on-surface">
              No {activeSubject} courses
            </p>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Try another subject or check back later.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveSubject("All")}
          >
            Show all
          </Button>
        </div>
      )}
    </div>
  );
}
