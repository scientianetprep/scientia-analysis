import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { env } from "@/lib/env";
import {
  ChevronLeft,
  Trophy,
  AlertCircle,
  Clock,
  Target,
  ArrowRight,
  Download,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ScoreBreakdown } from "@/components/dashboard/ScoreBreakdown";
import { ResultsAnalytics } from "@/components/dashboard/ResultsAnalytics";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ scoreId: string }>;
}

export default async function TestResultPage({ params }: PageProps) {
  const { scoreId } = await params;
  const cookieStore = await cookies();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) =>
          cs.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: score } = await supabase
    .from("scores")
    .select("*, tests(*)")
    .eq("id", scoreId)
    .single();

  if (!score || score.user_id !== user.id) notFound();

  const isPassed = score.percentage >= (score.tests?.pass_percentage ?? 50);

  const { data: session } = await supabase
    .from("exam_sessions")
    .select("id")
    .eq("score_id", scoreId)
    .maybeSingle();

  let answers: { question_id: string; selected: string | null }[] = [];
  let questions: any[] = [];

  if (session?.id) {
    const { data: rawAnswers } = await supabase
      .from("exam_answers")
      .select("question_id, selected")
      .eq("session_id", session.id);

    answers = rawAnswers ?? [];

    const questionIds = score.tests?.question_ids ?? [];
    if (questionIds.length > 0) {
      const { data: rawQuestions } = await supabase
        .from("questions")
        .select(
          "id, text, option_a, option_b, option_c, option_d, correct, explanation, topic, subject"
        )
        .in("id", questionIds);
      questions = rawQuestions ?? [];
    }
  }

  const formattedTime = (() => {
    if (!score.time_taken_seconds) return "—";
    const min = Math.floor(score.time_taken_seconds / 60);
    const sec = score.time_taken_seconds % 60;
    return `${min}m ${sec}s`;
  })();

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <header className="flex flex-col gap-3">
        <Link
          href="/dashboard/tests"
          className="inline-flex items-center gap-1.5 text-xs font-poppins font-medium text-outline hover:text-tertiary transition-colors w-fit"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Back to tests
        </Link>
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              <span className="px-2 py-0.5 bg-tertiary/10 text-tertiary rounded-full text-[11px] font-poppins font-medium">
                {score.tests?.subject}
              </span>
              {score.tests?.is_mock && (
                <span className="inline-flex items-center gap-1 text-brand-primary text-[11px] font-poppins font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
                  Mock exam
                </span>
              )}
            </div>
            <h1 className="text-xl md:text-2xl font-poppins font-semibold tracking-tight text-on-surface text-balance">
              {score.tests?.name}
            </h1>
            <p className="text-xs text-outline mt-1">
              Completed{" "}
              {new Date(score.created_at).toLocaleDateString(undefined, {
                dateStyle: "medium",
              })}
            </p>
          </div>

          <a
            href={`/api/exam/transcript/${scoreId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-md border border-outline-variant/20 bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-poppins font-medium transition-colors shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Transcript
          </a>
        </div>
      </header>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {/* Score */}
        <div
          className={cn(
            "surface-card p-3 flex items-center gap-2.5",
            isPassed ? "bg-green-500/5" : "bg-brand-accent/5"
          )}
        >
          <div
            className={cn(
              "w-9 h-9 rounded-md flex items-center justify-center shrink-0",
              isPassed
                ? "bg-green-500 text-white"
                : "bg-brand-accent text-white"
            )}
          >
            {isPassed ? (
              <Trophy className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xl font-poppins font-semibold tabular-nums text-on-surface">
              {Math.round(score.percentage)}%
            </p>
            <p
              className={cn(
                "text-[11px] font-poppins font-medium",
                isPassed ? "text-green-500" : "text-brand-accent"
              )}
            >
              {isPassed ? "Passed" : "Failed"}
            </p>
          </div>
        </div>

        {/* Accuracy */}
        <div className="surface-card p-3">
          <div className="flex items-center gap-1.5 text-outline mb-1">
            <Target className="w-3.5 h-3.5" />
            <span className="text-[11px] font-poppins font-medium">
              Accuracy
            </span>
          </div>
          <p className="text-xl font-poppins font-semibold tabular-nums text-on-surface">
            {score.correct_count}
            <span className="text-base text-outline-variant">
              {" / "}
              {score.total_count}
            </span>
          </p>
          <p className="text-[11px] text-outline mt-0.5">
            Correct answers out of all questions
          </p>
        </div>

        {/* Time */}
        <div className="surface-card p-3">
          <div className="flex items-center gap-1.5 text-outline mb-1">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-[11px] font-poppins font-medium">
              Time taken
            </span>
          </div>
          <p className="text-xl font-poppins font-semibold tabular-nums text-on-surface">
            {formattedTime}
          </p>
          <p className="text-[11px] text-outline mt-0.5">
            Out of {score.tests?.time_limit ?? "—"} min allowed
          </p>
        </div>
      </div>

      {/* Performance breakdown */}
      <div className="surface-card p-4 flex flex-col md:flex-row gap-4 items-start md:items-center">
        <div className="flex-1 space-y-1.5 min-w-0">
          <h3 className="text-sm font-poppins font-semibold text-on-surface">
            Performance breakdown
          </h3>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            This metric shows structural learning gaps. Use the topic breakdown below to identify areas needing more practice.
          </p>
          <Link
            href="/dashboard/courses"
            className="inline-flex items-center gap-1 text-tertiary text-xs font-poppins font-medium hover:underline"
          >
            Revisit corresponding courses
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="w-full md:w-56 flex items-center justify-center p-3 bg-surface-container-high rounded-md">
          <ResultsAnalytics
            correct={score.correct_count}
            total={score.total_count}
          />
        </div>
      </div>

      {/* Detailed breakdown */}
      {questions.length > 0 ? (
        <ScoreBreakdown questions={questions} answers={answers} />
      ) : (
        <div className="surface-card p-4 text-center">
          <p className="text-xs text-on-surface-variant">
            Detailed question review is available for exams taken with the new session engine.
          </p>
        </div>
      )}
    </div>
  );
}
