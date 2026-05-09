import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { env } from "@/lib/env";
import {
  CheckCircle2,
  Lock,
  ChevronLeft,
  Layers,
  BookOpen,
  StickyNote,
  FileText,
  Play,
  Coins,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { LessonRenderer } from "@/components/dashboard/LessonRenderer";
import { CompletionButton } from "@/components/dashboard/CompletionButton";
import { PersonalNotesEditor } from "@/components/dashboard/PersonalNotesEditor";
import { CreditConfirmGate } from "@/components/dashboard/CreditConfirmGate";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ lessonId?: string; view?: "content" | "notes" }>;
}

export default async function LessonViewerPage({ params, searchParams }: PageProps) {
  const { courseId } = await params;
  const { lessonId: currentLessonId, view = "content" } = await searchParams;

  const cookieStore = await cookies();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: course } = await supabase
    .from("courses")
    .select("id, title, subject, short_description, description, visibility")
    .eq("id", courseId)
    .single();

  if (!course) notFound();

  // Access model — restricted/private courses need a grant
  const [{ data: profile }, { data: grantRows }] = await Promise.all([
    supabase.from("profiles").select("role").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("course_access_grants")
      .select("id, access_tier")
      .eq("user_id", user.id)
      .eq("course_id", courseId)
      .eq("is_active", true)
      .is("revoked_at", null)
      .limit(1),
  ]);

  const isAdmin = profile?.role === "admin";
  const hasGrant = (grantRows?.length ?? 0) > 0;
  const visibility = (course as any).visibility ?? "open";
  const needsGrant = visibility === "restricted" || visibility === "private";

  if (!isAdmin && needsGrant && !hasGrant) {
    return (
      <div className="max-w-lg mx-auto mt-10 rounded-lg border border-outline-variant/15 bg-surface-container-low p-6 md:p-8 space-y-4 text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-tertiary/10 grid place-items-center">
          <Lock className="w-5 h-5 text-tertiary" />
        </div>
        <div className="space-y-1">
          <p className="text-[11px] text-tertiary font-medium uppercase tracking-wide">
            {course.subject ?? "Course"}
          </p>
          <h1 className="text-lg md:text-xl font-poppins font-semibold text-on-surface text-pretty">
            {course.title}
          </h1>
          {course.short_description && (
            <p className="text-sm text-on-surface-variant leading-relaxed">
              {course.short_description}
            </p>
          )}
        </div>
        <div className="rounded-md border border-outline-variant/15 bg-surface-container-high/40 p-3 text-sm text-on-surface-variant leading-relaxed">
          This course is available to enrolled students only. Reach out to your
          administrator to request access — once you&apos;re enrolled, every
          lesson, note and completion will unlock here automatically.
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Link
            href="/dashboard/courses"
            className="inline-flex items-center justify-center gap-1 h-9 px-4 rounded-md text-sm font-poppins font-medium bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back to library
          </Link>
          <Link
            href="/dashboard/feedback"
            className="inline-flex items-center justify-center h-9 px-4 rounded-md text-sm font-poppins font-medium bg-tertiary text-white hover:bg-tertiary/90 transition-colors"
          >
            Request enrollment
          </Link>
        </div>
      </div>
    );
  }

  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, title, content_type, content_body, sequence_order")
    .eq("course_id", courseId)
    .eq("is_published", true)
    .order("sequence_order", { ascending: true });

  if (!lessons || lessons.length === 0) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-3">
        <Layers className="w-8 h-8 text-outline/40" />
        <h2 className="text-lg font-poppins font-semibold text-on-surface">No lessons yet</h2>
        <p className="text-sm text-on-surface-variant max-w-xs">
          This course is currently empty. Check back later for content.
        </p>
        <Link href="/dashboard/courses" className="text-sm text-tertiary font-medium hover:underline">
          Return to Library
        </Link>
      </div>
    );
  }

  const { data: completions } = await supabase
    .from("lesson_completions")
    .select("lesson_id")
    .eq("user_id", user.id);

  const completedIds = new Set(completions?.map((c) => c.lesson_id) || []);

  const activeLesson = currentLessonId
    ? lessons.find((l) => l.id === currentLessonId) || lessons[0]
    : lessons[0];

  // ── Credit resolution ────────────────────────────────────────────────────
  // Rule: if a course-level price exists, it covers ALL lessons in the course.
  // Individual lesson prices only apply when NO course-level price is set.
  // Admins always bypass.

  const lessonIds = lessons.map((l) => l.id);

  const [
    { data: coursePriceRow },
    { data: courseUnlockRow },
    { data: lessonPrices },
    { data: lessonUnlocks },
    { data: noteReq },
  ] = await Promise.all([
    // Course-level price
    supabase
      .from("content_prices")
      .select("credit_cost, is_free")
      .eq("content_type", "course")
      .eq("content_id", courseId)
      .maybeSingle(),
    // Course-level unlock
    supabase
      .from("content_unlocks")
      .select("id")
      .eq("user_id", user.id)
      .eq("content_type", "course")
      .eq("content_id", courseId)
      .maybeSingle(),
    // Lesson-level prices (used only when no course price)
    supabase
      .from("content_prices")
      .select("content_id, credit_cost, is_free")
      .eq("content_type", "lesson")
      .in("content_id", lessonIds),
    // Lesson-level unlocks
    supabase
      .from("content_unlocks")
      .select("content_id")
      .eq("user_id", user.id)
      .eq("content_type", "lesson")
      .in("content_id", lessonIds),
    // Personal notes for active lesson
    supabase
      .from("personal_notes")
      .select("content")
      .eq("user_id", user.id)
      .eq("lesson_id", activeLesson.id)
      .maybeSingle(),
  ]);

  // Determine if the course has a real credit cost
  const courseCreditCost =
    coursePriceRow && !coursePriceRow.is_free && (coursePriceRow.credit_cost ?? 0) > 0
      ? coursePriceRow.credit_cost
      : 0;
  const courseHasPrice = courseCreditCost > 0;
  const courseUnlocked = !!courseUnlockRow;

  // If course-level price exists and student hasn't unlocked it yet, gate at course level
  let courseCreditGate: React.ReactNode = null;
  if (!isAdmin && courseHasPrice && !courseUnlocked) {
    const { data: account } = await supabase
      .from("credit_accounts")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle();

    courseCreditGate = (
      <CreditConfirmGate
        contentType="course"
        contentId={courseId}
        contentName={course.title}
        contentSubject={course.subject ?? null}
        creditCost={courseCreditCost}
        balance={account?.balance ?? 0}
        backHref="/dashboard/courses"
      />
    );
  }

  // Lesson-level maps (only relevant when no course-level price)
  const lessonPriceMap: Record<string, number> = {};
  const freeLessonIds = new Set<string>();
  const lessonUnlockedIds = new Set((lessonUnlocks ?? []).map((u) => u.content_id));

  if (!courseHasPrice) {
    for (const p of lessonPrices ?? []) {
      if (p.is_free || p.credit_cost === 0) {
        freeLessonIds.add(p.content_id);
      } else if (p.credit_cost > 0) {
        lessonPriceMap[p.content_id] = p.credit_cost;
      }
    }
  }

  // Determine if the active lesson needs a credit gate
  // — course price: covered once course is unlocked
  // — no course price: check individual lesson price
  const activeLessonCost = courseHasPrice ? 0 : (lessonPriceMap[activeLesson.id] ?? 0);
  const activeLessonUnlocked = courseHasPrice ? courseUnlocked : lessonUnlockedIds.has(activeLesson.id);
  const isCreditLocked = !isAdmin && activeLessonCost > 0 && !activeLessonUnlocked;

  let lessonCreditGate: React.ReactNode = null;
  if (isCreditLocked) {
    const { data: account } = await supabase
      .from("credit_accounts")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle();
    lessonCreditGate = (
      <CreditConfirmGate
        contentType="lesson"
        contentId={activeLesson.id}
        contentName={activeLesson.title}
        contentSubject={course.subject ?? null}
        creditCost={activeLessonCost}
        balance={account?.balance ?? 0}
        backHref="/dashboard/courses"
      />
    );
  }
  // ── End credit resolution ─────────────────────────────────────────────────

  const activeIndex = lessons.findIndex((l) => l.id === activeLesson.id);
  const isSequenceLocked = activeIndex > 0 && !completedIds.has(lessons[activeIndex - 1].id);
  const progressPct = Math.round((completedIds.size / lessons.length) * 100);

  // If the entire course is credit-gated, show the full-page gate before rendering anything
  if (courseCreditGate) return <>{courseCreditGate}</>;

  return (
    <div className="flex flex-col lg:flex-row gap-2.5 lg:flex-1">
      {/* Curriculum rail */}
      <aside className="w-full lg:w-[280px] shrink-0 flex flex-col h-fit rounded-sm border border-outline-variant/15 bg-surface-container-low overflow-hidden lg:sticky lg:top-5">
        {/* Back + course */}
        <div className="px-3 pt-3 pb-2 border-b border-outline-variant/15">
          <Link
            href="/dashboard/courses"
            className="inline-flex items-center gap-1 text-xs font-poppins text-on-surface-variant hover:text-on-surface transition-colors mb-2"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Library
          </Link>
          <p className="text-[11px] text-tertiary font-medium">{course.subject}</p>
          <h2 className="text-sm font-poppins font-semibold text-on-surface leading-snug line-clamp-2">
            {course.title}
          </h2>

          {/* Progress */}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-surface-container-high overflow-hidden">
              <div
                className="h-full bg-tertiary rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-[11px] font-poppins font-medium text-on-surface tabular-nums">{progressPct}%</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex p-1 gap-1 border-b border-outline-variant/15">
          <Link
            href={`/dashboard/courses/${courseId}?lessonId=${activeLesson.id}&view=content`}
            className={cn(
              "flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-md text-xs font-poppins font-medium transition-colors",
              view === "content"
                ? "bg-surface-container-high text-on-surface"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
            )}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Lessons
          </Link>
          <Link
            href={`/dashboard/courses/${courseId}?lessonId=${activeLesson.id}&view=notes`}
            className={cn(
              "flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-md text-xs font-poppins font-medium transition-colors",
              view === "notes"
                ? "bg-surface-container-high text-on-surface"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
            )}
          >
            <StickyNote className="w-3.5 h-3.5" />
            Notes
          </Link>
        </div>

        {view === "content" ? (
          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
            {lessons.map((lesson: any, index: number) => {
              const isCompleted = completedIds.has(lesson.id);
              const isCurrent = lesson.id === activeLesson.id;
              const seqLocked = index > 0 && !completedIds.has(lessons[index - 1].id);
              // If course has a price and is unlocked → all lessons are unlocked, no badge needed
              // If no course price → check per-lesson price
              const cost = courseHasPrice ? 0 : (lessonPriceMap[lesson.id] ?? 0);
              const isFreeLesson = !courseHasPrice && freeLessonIds.has(lesson.id);
              const creditLocked = !isAdmin && !courseHasPrice && cost > 0 && !lessonUnlockedIds.has(lesson.id);

              return (
                <Link
                  key={lesson.id}
                  href={seqLocked ? "#" : `/dashboard/courses/${courseId}?lessonId=${lesson.id}&view=content`}
                  className={cn(
                    "flex items-start gap-2 px-2 py-2 rounded-md transition-colors group",
                    isCurrent
                      ? "bg-tertiary/10 text-on-surface"
                      : "hover:bg-surface-container-high text-on-surface-variant",
                    seqLocked && "opacity-40 cursor-not-allowed pointer-events-none"
                  )}
                >
                  <span className="w-4 h-4 shrink-0 mt-0.5 flex items-center justify-center">
                    {isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                    ) : seqLocked ? (
                      <Lock className="w-3 h-3 text-outline" />
                    ) : lesson.content_type === "video" ? (
                      <Play className="w-3 h-3 text-outline" />
                    ) : (
                      <FileText className="w-3 h-3 text-outline" />
                    )}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[11px] text-outline tabular-nums leading-tight">
                      #{index + 1}
                    </span>
                    <span
                      className={cn(
                        "block text-sm font-poppins leading-snug line-clamp-2",
                        isCurrent ? "font-semibold text-on-surface" : "font-medium"
                      )}
                    >
                      {lesson.title}
                    </span>
                  </span>
                  {/* Credit / free badge on sidebar item */}
                  {!seqLocked && (
                    <span className="shrink-0 mt-0.5">
                      {isFreeLesson || cost === 0 && !creditLocked ? (
                        <span className="h-4 px-1.5 rounded text-[9px] font-bold bg-green-500/10 text-green-600">
                          FREE
                        </span>
                      ) : creditLocked ? (
                        <span className="h-4 px-1.5 rounded text-[9px] font-bold bg-tertiary/10 text-tertiary flex items-center gap-0.5">
                          <Coins className="w-2.5 h-2.5" />
                          {cost}
                        </span>
                      ) : null}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <PersonalNotesEditor
              lessonId={activeLesson.id}
              userId={user.id}
              initialContent={noteReq?.content || ""}
            />
          </div>
        )}
      </aside>

      {/* Reader */}
      <section className="flex-1 min-w-0 flex flex-col rounded-sm border border-outline-variant/15 bg-surface-container-low overflow-hidden">
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="w-full px-4 md:px-8 py-5 md:py-7 space-y-5">
            {isSequenceLocked ? (
              <div className="h-[50vh] flex flex-col items-center justify-center text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center">
                  <Lock className="w-5 h-5 text-outline" />
                </div>
                <h2 className="text-lg font-poppins font-semibold text-on-surface">Access restricted</h2>
                <p className="text-sm text-on-surface-variant max-w-sm">
                  Complete{" "}
                  <strong className="text-on-surface">
                    {activeIndex > 0 ? lessons[activeIndex - 1].title : "previous lessons"}
                  </strong>{" "}
                  to unlock this module.
                </p>
              </div>
            ) : isCreditLocked ? (
              lessonCreditGate
            ) : (
              <>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-outline">
                    <span className="tabular-nums">Module {activeLesson.sequence_order}</span>
                    <span>•</span>
                    <span>{activeLesson.content_type === "video" ? "15–20 min" : "10–15 min"}</span>
                    {/* Unlocked badge if this lesson was paid and is now open */}
                    {!courseHasPrice && activeLessonCost > 0 && lessonUnlockedIds.has(activeLesson.id) ? (
                      <span className="h-4 px-1.5 rounded text-[9px] font-bold bg-blue-500/10 text-blue-600 ml-auto flex items-center gap-0.5">
                        <Coins className="w-2.5 h-2.5" />
                        Unlocked
                      </span>
                    ) : courseHasPrice && courseUnlocked ? (
                      <span className="h-4 px-1.5 rounded text-[9px] font-bold bg-blue-500/10 text-blue-600 ml-auto flex items-center gap-0.5">
                        <Coins className="w-2.5 h-2.5" />
                        Course unlocked
                      </span>
                    ) : freeLessonIds.has(activeLesson.id) ? (
                      <span className="h-4 px-1.5 rounded text-[9px] font-bold bg-green-500/10 text-green-600 ml-auto">
                        FREE
                      </span>
                    ) : null}
                  </div>
                  <h1 className="text-xl md:text-2xl font-poppins font-bold text-on-surface leading-tight text-pretty">
                    {activeLesson.title}
                  </h1>
                </div>

                <div className="border-t border-outline-variant/10" />

                <div>
                  <LessonRenderer
                    type={activeLesson.content_type}
                    content={activeLesson.content_body}
                    lessonId={activeLesson.id}
                    userId={user.id}
                  />
                </div>

                <div className="pt-4 border-t border-outline-variant/15 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <p className="text-xs text-outline">Marking complete unlocks the next module.</p>
                  <CompletionButton
                    lessonId={activeLesson.id}
                    userId={user.id}
                    initialCompleted={completedIds.has(activeLesson.id)}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
