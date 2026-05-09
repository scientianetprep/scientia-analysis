"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Timer,
  Flag,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CheckCircle2,
  AlertCircle,
  Save,
  HelpCircle,
  X,
  ShieldAlert,
  Grid3x3,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";

const VIOLATION_THRESHOLD = 6;
const VIOLATION_COOLDOWN_MS = 2000;

type ImagePosition = "right" | "top" | "bottom" | "inline";

interface Question {
  id: string;
  text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct: string;
  explanation: string;
  marks?: number | null;
  subject?: string | null;
  topic?: string | null;
  image_url?: string | null;
  image_position?: ImagePosition | null;
}

interface TestSection {
  name: string;
  subject: string;
  question_ids: string[];
}

interface QuizEngineProps {
  test: {
    id: string;
    name: string;
    time_limit: number;
    subject?: string | null;
    instructions?: string | null;
    [key: string]: unknown;
  };
  questions: Question[];
  userId: string;
  /**
   * Candidate info for the header strip. Sourced from `profiles` on the
   * server so the light-themed exam UI always shows real DB data.
   */
  student?: {
    fullName: string;
    username: string | null;
  };
  /**
   * Optional section manifest for full-length tests. When present, the
   * Next Section / Prev Section toolbar buttons become active and jump
   * to the first question of the adjacent section.
   */
  sections?: TestSection[];
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin", className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

export function QuizEngine({
  test,
  questions,
  userId: _userId,
  student,
  sections,
}: QuizEngineProps) {
  const router = useRouter();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [timeLeft, setTimeLeft] = useState(test.time_limit * 60);

  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isConfirmFinishOpen, setIsConfirmFinishOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Once a submission lands we flip `isFinished` so the timer, anticheat
  // listeners, and UI all go inert — but we do NOT render a success
  // screen here. The component redirects to `/dashboard` instantly per
  // the product requirement. The flag only exists to stop background
  // work while the router transition resolves.
  const [isFinished, setIsFinished] = useState(false);
  const [violationCount, setViolationCount] = useState(0);

  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastViolationTime = useRef<number>(0);
  const submitRef = useRef(handleSubmit);
  submitRef.current = handleSubmit;

  const hasInitiated = useRef(false);

  useEffect(() => {
    if (hasInitiated.current) return;
    hasInitiated.current = true;

    async function initSession() {
      try {
        const res = await fetch("/api/exam/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ test_id: test.id }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error ?? "Failed to start session");
          router.push("/dashboard/tests");
          return;
        }
        setSessionId(data.session_id);

        if (data.resumed && data.saved_answers?.length) {
          const restored: Record<string, string> = {};
          const restoredFlags: Record<string, boolean> = {};
          for (const a of data.saved_answers) {
            if (a.selected) restored[a.question_id] = a.selected;
            if (a.is_flagged) restoredFlags[a.question_id] = true;
          }
          setAnswers(restored);
          setFlags(restoredFlags);
          if (data.time_remaining_s != null) setTimeLeft(data.time_remaining_s);
          toast.info("Session resumed from where you left off.", { duration: 4000 });
        }
      } catch {
        toast.error("Network error — could not start session");
        router.push("/dashboard/tests");
      } finally {
        setSessionLoading(false);
      }
    }
    initSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (sessionLoading || isFinished) return;
    if (timeLeft <= 0) {
      submitRef.current("timed_out");
      return;
    }
    const timer = setInterval(() => setTimeLeft((p) => p - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, isFinished, sessionLoading]);

  const recordViolation = useCallback(
    async (type: string) => {
      if (!sessionId || isFinished) return;

      const now = Date.now();
      if (now - lastViolationTime.current < VIOLATION_COOLDOWN_MS) return;
      lastViolationTime.current = now;

      try {
        const res = await fetch("/api/exam/violation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId, violation_type: type }),
        });
        const data = await res.json();
        const count = data.violation_count ?? violationCount + 1;
        setViolationCount(count);

        const remaining = VIOLATION_THRESHOLD - count;
        if (remaining > 0) {
          toast.warning(`Violation Detected: ${type.replace("_", " ")}`, {
            description: `You have used ${count} of ${VIOLATION_THRESHOLD} permitted violations.`,
            duration: 6000,
          });
        }

        if (count >= VIOLATION_THRESHOLD) {
          toast.error("Max Violations Reached", {
            description: "The permitted 6 violations have been exceeded. Your exam is being auto-submitted now.",
            duration: 8000,
          });
          setTimeout(() => submitRef.current("auto_submitted"), 2000);
        }
      } catch {
        const nextCount = violationCount + 1;
        setViolationCount(nextCount);
        if (nextCount >= VIOLATION_THRESHOLD) {
          submitRef.current("auto_submitted");
        }
      }
    },
    [sessionId, isFinished, violationCount]
  );

  useEffect(() => {
    if (!sessionId || isFinished) return;
    const handleVisibility = () => {
      if (document.hidden) recordViolation("tab_switch");
    };
    const handleBlur = () => recordViolation("focus_loss");
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
    };
  }, [sessionId, recordViolation, isFinished]);

  useEffect(() => {
    if (!sessionId || isFinished) return;
    const blockKeys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ["c", "v", "a", "p", "s", "u"].includes(e.key.toLowerCase())) {
        e.preventDefault();
        recordViolation("copy_attempt");
      }
    };
    const blockCtx = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("keydown", blockKeys);
    document.addEventListener("contextmenu", blockCtx);
    return () => {
      document.removeEventListener("keydown", blockKeys);
      document.removeEventListener("contextmenu", blockCtx);
    };
  }, [sessionId, recordViolation, isFinished]);

  const handleAnswer = useCallback(
    (option: string) => {
      if (isFinished) return;
      const qId = questions[currentIdx].id;
      setAnswers((prev) => ({ ...prev, [qId]: option }));

      if (!sessionId) return;
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(async () => {
        try {
          const res = await fetch("/api/exam/answer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              session_id: sessionId,
              question_id: qId,
              selected: option,
              time_remaining_s: Math.max(0, timeLeft),
            }),
          });
          if (!res.ok) throw new Error("Failed to sync answer");
        } catch (e: unknown) {
          console.error(e);
          toast.error("Connection problem", { description: "Answer not saved." });
        }
      }, 800);
    },
    [currentIdx, questions, sessionId, timeLeft]
  );

  const toggleFlag = useCallback(async () => {
    if (isFinished) return;
    const qId = questions[currentIdx].id;
    const newVal = !flags[qId];
    setFlags((prev) => ({ ...prev, [qId]: newVal }));

    if (!sessionId) return;
    try {
      const res = await fetch("/api/exam/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          question_id: qId,
          selected: answers[qId] ?? null,
          is_flagged: newVal,
          time_remaining_s: Math.max(0, timeLeft),
        }),
      });
      if (!res.ok) throw new Error("Failed to sync flag");
    } catch (e: unknown) {
      console.error(e);
    }
  }, [currentIdx, questions, sessionId, flags, answers, timeLeft]);

  async function handleSubmit(_reason: string = "submitted") {
    if (isSubmitting || isFinished) return;
    setIsSubmitting(true);
    // Flip `isFinished` first so the timer and anti-cheat listeners go
    // inert immediately. We then _await_ the submit before navigating so
    // the request can't be cancelled by the tab unload (the previous
    // fire-and-navigate flow left sessions stuck at `in_progress` because
    // the browser aborted the in-flight fetch on router.replace). As a
    // belt-and-braces safeguard we also set `keepalive: true` — if for
    // any reason the tab closes before this awaits, Chromium and Firefox
    // will still flush the request body to the network.
    setIsFinished(true);
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
      saveTimeout.current = null;
    }

    const payload = {
      session_id: sessionId,
      answers: Object.fromEntries(
        questions.map((q) => [q.id, answers[q.id] ?? null])
      ),
      time_taken: test.time_limit * 60 - timeLeft,
      status: _reason,
    };

    const submissionToast = toast.loading("Uploading your answers…");
    let ok = false;
    try {
      const res = await fetch("/api/exam/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Submission failed");
      ok = true;
      toast.success("Session submitted successfully", { id: submissionToast });
    } catch (e: any) {
      toast.error("Submission failed", {
        id: submissionToast,
        description:
          e?.message ??
          "Your answers could not be uploaded. Please contact support.",
        duration: 10000,
      });
    } finally {
      // Always bounce back to the dashboard — either the submit succeeded
      // (happy path) or it failed and we've surfaced a toast that will
      // follow the user across the navigation. Staying on the exam shell
      // with `isFinished=true` just shows a frozen UI.
      router.replace(ok ? "/dashboard?submitted=1" : "/dashboard");
    }
  }

  // Manual save: flushes any pending debounced write and then pings the
  // answer endpoint once so the user gets an explicit acknowledgement
  // when they press the Save button. All real persistence still goes
  // through /api/exam/answer — this is just an assertive wrapper.
  const saveNow = useCallback(async () => {
    if (!sessionId) return;
    const qId = questions[currentIdx]?.id;
    if (!qId) return;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    try {
      const res = await fetch("/api/exam/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          question_id: qId,
          selected: answers[qId] ?? null,
          is_flagged: !!flags[qId],
          time_remaining_s: Math.max(0, timeLeft),
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Answer saved", { duration: 1500 });
    } catch {
      toast.error("Couldn't save answer — check your connection");
    }
  }, [sessionId, currentIdx, questions, answers, flags, timeLeft]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const currentQuestion = questions[currentIdx];
  const answeredCount = Object.keys(answers).length;

  // Resolve which section the current question belongs to. For non-
  // full-length tests `sections` is undefined and this is simply null.
  // For full-length tests we index from the section manifest so the
  // top-strip subject and Next/Prev Section buttons line up with the
  // admin-configured grouping.
  const currentSectionIndex =
    sections && sections.length > 0
      ? sections.findIndex((s) =>
          s.question_ids.includes(currentQuestion?.id ?? "")
        )
      : -1;
  const currentSection =
    currentSectionIndex >= 0 ? sections![currentSectionIndex] : null;

  // Subject label for the top strip. Falls back through: current
  // section → question → test. Hard-coded fallbacks were removed per
  // the user's request; if nothing is available we simply hide the
  // badge (the test name in the centre still identifies the exam).
  const displaySubject =
    currentSection?.subject ??
    currentQuestion?.subject ??
    (typeof test.subject === "string" ? test.subject : "") ??
    "";

  const timeLow = timeLeft < 300;

  /**
   * Jump to the first question of an adjacent section. Bails safely
   * when we're at an edge or when sections aren't configured.
   */
  const jumpToSection = useCallback(
    (direction: 1 | -1) => {
      if (!sections || sections.length === 0 || currentSectionIndex < 0) return;
      const target = currentSectionIndex + direction;
      if (target < 0 || target >= sections.length) return;
      const firstQid = sections[target].question_ids[0];
      const idx = questions.findIndex((q) => q.id === firstQid);
      if (idx >= 0) setCurrentIdx(idx);
    },
    [sections, currentSectionIndex, questions]
  );

  if (sessionLoading) {
    // Locked light theme — this page must always render light regardless
    // of the user's global theme preference, so we use hardcoded slate
    // shades instead of semantic tokens.
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center z-[100]">
        <div className="text-center space-y-3">
          <Spinner className="w-7 h-7 text-slate-700 mx-auto" />
          <p className="text-slate-600 font-poppins text-sm">Preparing your session…</p>
        </div>
      </div>
    );
  }

  const imgPos: ImagePosition = currentQuestion.image_position ?? "right";
  const hasImage = Boolean(currentQuestion.image_url);

  return (
    // Locked light theme. The rest of the app respects dark mode but the
    // exam surface is deliberately light (matches the brief and the
    // legacy reference). All surfaces are white / slate-50 with a single
    // sky-blue band borrowed from the NUST reference for the question
    // header and answer highlight.
    // Locked light theme with hardcoded hex colours — avoids any
    // globals.css overrides that were dimming text to ~#e4e2e4 before.
    <div
      className="fixed inset-0 z-[100] flex flex-col touch-none"
      style={{ backgroundColor: "#f8fafc", color: "#0f172a" }}
    >
      {/* Candidate strip — dynamic subject from section/question, centre
          shows test name, right side shows the candidate. */}
      <header
        className="shrink-0 h-11 px-3 md:px-5 flex items-center gap-3 border-b"
        style={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0" }}
      >
        <div className="min-w-0 flex items-center gap-2 flex-1 basis-0">
          {displaySubject && (
            <span
              className="hidden sm:inline text-[12px] font-poppins font-semibold truncate"
              style={{ color: "#047857" }}
              title={
                currentSection
                  ? `Section: ${currentSection.name}`
                  : displaySubject
              }
            >
              {displaySubject}
            </span>
          )}
          {sections && sections.length > 1 && currentSectionIndex >= 0 && (
            <span
              className="hidden md:inline-flex items-center h-5 px-1.5 rounded text-[10px] font-poppins font-medium tabular-nums"
              style={{ backgroundColor: "#f1f5f9", color: "#475569" }}
            >
              Section {currentSectionIndex + 1}/{sections.length}
            </span>
          )}
        </div>
        <h1
          className="flex-1 basis-0 min-w-0 text-center text-[13px] md:text-sm font-poppins font-semibold truncate"
          style={{ color: "#0f172a" }}
        >
          {test.name}
        </h1>
        <div className="min-w-0 flex items-center gap-2 justify-end flex-1 basis-0">
          {violationCount > 0 && (
            <span
              className="hidden md:inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] font-poppins font-medium tabular-nums border"
              style={{
                backgroundColor: "#fffbeb",
                borderColor: "#fde68a",
                color: "#b45309",
              }}
              title="Violations detected"
            >
              <ShieldAlert className="w-3 h-3" />
              {violationCount}/{VIOLATION_THRESHOLD}
            </span>
          )}
          {student?.fullName && (
            <div className="text-right leading-tight">
              <div
                className="text-[12px] font-poppins font-semibold truncate max-w-[180px]"
                style={{ color: "#0f172a" }}
              >
                {student.fullName}
              </div>
              {student.username && (
                <div
                  className="text-[10px] truncate max-w-[180px]"
                  style={{ color: "#64748b" }}
                >
                  @{student.username}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Question band — light blue, now ONLY shows the question counter
          (the "Marks" label was pulled out per the user's note). */}
      <div
        className="shrink-0 h-8 px-3 md:px-5 border-b flex items-center text-[12px] font-poppins"
        style={{ backgroundColor: "#f0f9ff", borderColor: "#e0f2fe" }}
      >
        <span style={{ color: "#334155" }}>
          Question No:{" "}
          <span
            className="font-semibold tabular-nums"
            style={{ color: "#0369a1" }}
          >
            {currentIdx + 1}
          </span>{" "}
          <span style={{ color: "#64748b" }}>of</span>{" "}
          <span className="tabular-nums" style={{ color: "#0369a1" }}>
            {questions.length}
          </span>
        </span>
      </div>

      <main className="flex-1 overflow-y-auto overscroll-contain">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-5 md:py-6 space-y-5">
          <div
            className="rounded-lg border p-4 md:p-5 space-y-4 shadow-sm"
            style={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0" }}
          >
            {/* Header row: question stem + review button. For images
                positioned 'right' the question + stem share row space
                with an image panel (NUST "Photograph" layout). For all
                other positions the image lives in its own row. */}
            {hasImage && imgPos === "top" && (
              <QuestionImage url={currentQuestion.image_url!} />
            )}

            <div
              className={cn(
                "flex gap-4",
                hasImage && imgPos === "right"
                  ? "flex-col md:flex-row md:items-start"
                  : "flex-col"
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                    <div className="text-[15px] md:text-base leading-relaxed flex-1 font-poppins prose prose-sm max-w-none prose-slate">
                      <MarkdownRenderer content={currentQuestion.text} />
                    </div>
                  <button
                    onClick={toggleFlag}
                    disabled={isFinished}
                    className={cn(
                      "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-poppins font-medium transition-colors shrink-0 disabled:opacity-50"
                    )}
                    style={
                      flags[currentQuestion.id]
                        ? { backgroundColor: "#f59e0b", color: "#ffffff" }
                        : { backgroundColor: "#f1f5f9", color: "#334155" }
                    }
                    title="Mark this question for review"
                  >
                    <Flag
                      className={cn(
                        "w-3.5 h-3.5",
                        flags[currentQuestion.id] && "fill-white"
                      )}
                    />
                    <span className="hidden sm:inline">
                      {flags[currentQuestion.id] ? "Marked" : "Review"}
                    </span>
                  </button>
                </div>
              </div>
              {hasImage && imgPos === "right" && (
                <QuestionImage
                  url={currentQuestion.image_url!}
                  className="w-full md:w-56 md:shrink-0"
                />
              )}
            </div>

            {hasImage && imgPos === "inline" && (
              <QuestionImage url={currentQuestion.image_url!} />
            )}

            {/* Answer label band */}
            <div
              className="h-7 px-3 rounded-md flex items-center text-[11px] font-poppins border"
              style={{
                backgroundColor: "#f0f9ff",
                borderColor: "#e0f2fe",
                color: "#334155",
              }}
            >
              Answer{" "}
              <span className="ml-1" style={{ color: "#0369a1" }}>
                ( Please select your correct option )
              </span>
            </div>

            {/* Options */}
            <div className="space-y-2">
              {(["a", "b", "c", "d"] as const).map((key) => {
                const label = key.toUpperCase();
                const text = (currentQuestion as any)[`option_${key}`] as string;
                const isSelected = answers[currentQuestion.id] === label;
                return (
                  <button
                    key={key}
                    onClick={() => handleAnswer(label)}
                    disabled={isFinished}
                    className="w-full min-h-11 px-3 py-2.5 rounded-md border text-left transition-colors flex items-center gap-3 disabled:opacity-80"
                    style={
                      isSelected
                        ? { backgroundColor: "#e0f2fe", borderColor: "#38bdf8" }
                        : { backgroundColor: "#f8fafc", borderColor: "#e2e8f0" }
                    }
                  >
                    <span
                      className="w-5 h-5 shrink-0 rounded-full border flex items-center justify-center"
                      style={{
                        backgroundColor: "#ffffff",
                        borderColor: isSelected ? "#0ea5e9" : "#cbd5e1",
                      }}
                      aria-hidden="true"
                    >
                      {isSelected && (
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: "#0ea5e9" }}
                        />
                      )}
                    </span>
                    <span
                      className="w-6 shrink-0 font-poppins font-semibold text-xs tabular-nums"
                      style={{ color: "#475569" }}
                    >
                      {label}.
                    </span>
                    <div
                      className="text-sm flex-1 leading-snug font-poppins prose prose-sm max-w-none prose-slate"
                    >
                      <MarkdownRenderer content={text} />
                    </div>
                    {isSelected && (
                      <CheckCircle2
                        className="w-4 h-4 shrink-0"
                        style={{ color: "#0284c7" }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {hasImage && imgPos === "bottom" && (
              <QuestionImage url={currentQuestion.image_url!} />
            )}
          </div>
        </div>
      </main>

      {/* Action toolbar — icon + text labels in the NUST reference style */}
      <footer
        className="shrink-0 px-3 md:px-5 py-2 border-t"
        style={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0" }}
      >
        <div className="max-w-6xl mx-auto flex items-center gap-2 md:gap-3">
          {/* Timer card */}
          <div
            className="flex items-center gap-2 h-12 px-3 rounded-md shrink-0 transition-colors text-white"
            style={{
              backgroundColor: timeLow ? "#dc2626" : "#16a34a",
            }}
            role="timer"
            aria-live="polite"
          >
            <Timer className="w-4 h-4" />
            <div className="leading-tight">
              <div className="text-[15px] font-poppins font-semibold tabular-nums">
                {formatTime(timeLeft)}
              </div>
              <div className="text-[9px] uppercase tracking-wide opacity-90">
                Remaining
              </div>
            </div>
          </div>

          {/* Progress (md+) */}
          <div className="hidden md:flex flex-1 items-center gap-2 min-w-0">
            <div
              className="flex-1 h-1.5 rounded-full overflow-hidden"
              style={{ backgroundColor: "#e2e8f0" }}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${((currentIdx + 1) / questions.length) * 100}%`,
                  backgroundColor: "#0369a1",
                }}
              />
            </div>
            <span
              className="text-[11px] font-poppins tabular-nums shrink-0"
              style={{ color: "#64748b" }}
            >
              {answeredCount}/{questions.length} answered
            </span>
          </div>

          {/* Nav cluster */}
          <div className="flex items-center gap-1 ml-auto overflow-x-auto scrollbar-none">
            <ToolbarButton
              onClick={saveNow}
              label="Save"
              icon={<Save className="w-4 h-4" />}
              tone="primary"
            />
            <ToolbarButton
              onClick={() =>
                setCurrentIdx((p) => Math.min(questions.length - 1, p + 1))
              }
              disabled={currentIdx === questions.length - 1}
              label="Next"
              icon={<ChevronRight className="w-4 h-4" />}
            />
            <ToolbarButton
              onClick={() => setCurrentIdx((p) => Math.max(0, p - 1))}
              disabled={currentIdx === 0}
              label="Prev"
              icon={<ChevronLeft className="w-4 h-4" />}
            />
            <ToolbarButton
              onClick={() => setIsPaletteOpen(true)}
              label="Review"
              icon={<Grid3x3 className="w-4 h-4" />}
            />
            {sections && sections.length > 1 && (
              <>
                <ToolbarButton
                  onClick={() => jumpToSection(1)}
                  disabled={
                    currentSectionIndex < 0 ||
                    currentSectionIndex >= sections.length - 1
                  }
                  label="Next Section"
                  icon={<ChevronsRight className="w-4 h-4" />}
                />
                <ToolbarButton
                  onClick={() => jumpToSection(-1)}
                  disabled={currentSectionIndex <= 0 || isFinished}
                  label="Prev Section"
                  icon={<ChevronsLeft className="w-4 h-4" />}
                />
              </>
            )}
            <ToolbarButton
              onClick={() => setCurrentIdx(0)}
              disabled={currentIdx === 0 || isFinished}
              label="First"
              icon={<ChevronsLeft className="w-4 h-4" />}
            />
            <ToolbarButton
              onClick={() => setCurrentIdx(questions.length - 1)}
              disabled={currentIdx === questions.length - 1 || isFinished}
              label="Last"
              icon={<ChevronsRight className="w-4 h-4" />}
            />
            <ToolbarButton
              onClick={() => setIsHelpOpen(true)}
              label="Help"
              icon={<HelpCircle className="w-4 h-4" />}
            />
          </div>

          <button
            onClick={() => setIsConfirmFinishOpen(true)}
            disabled={isSubmitting || isFinished}
            className="inline-flex items-center gap-1.5 h-12 px-3 md:px-4 rounded-md font-poppins font-medium text-sm transition-colors shrink-0 disabled:opacity-50 text-white"
            style={{ backgroundColor: "#0369a1" }}
          >
            {isSubmitting ? <Spinner className="w-4 h-4 text-white" /> : null}
            <span>Finish</span>
          </button>
        </div>
      </footer>

      {/* Question palette drawer — light */}
      {isPaletteOpen && (
        <div className="fixed inset-0 z-[200] flex">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setIsPaletteOpen(false)}
          />
          <div className="relative mt-auto sm:ml-auto w-full sm:max-w-xs bg-white border-t sm:border-l border-slate-200 flex flex-col h-[65vh] sm:h-full rounded-t-lg sm:rounded-none shadow-xl">
            <div className="flex items-center justify-between px-3 h-11 border-b border-slate-200 bg-sky-50">
              <div>
                <h3 className="text-sm font-poppins font-semibold text-slate-900">
                  Questions
                </h3>
                <p className="text-[11px] text-slate-500 tabular-nums">
                  {answeredCount}/{questions.length} answered
                </p>
              </div>
              <button
                onClick={() => setIsPaletteOpen(false)}
                className="w-8 h-8 inline-flex items-center justify-center rounded-md hover:bg-white transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-slate-600" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 grid grid-cols-8 gap-1.5 content-start">
              {questions.map((q, idx) => (
                <button
                  key={q.id}
                  onClick={() => {
                    setCurrentIdx(idx);
                    setIsPaletteOpen(false);
                  }}
                  className={cn(
                    "aspect-square rounded-md border flex items-center justify-center font-poppins font-semibold text-xs transition-colors relative tabular-nums",
                    currentIdx === idx
                      ? "border-sky-500 bg-sky-500 text-white"
                      : answers[q.id]
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : flags[q.id]
                      ? "border-amber-300 bg-amber-50 text-amber-700"
                      : "border-slate-200 bg-white text-slate-500 hover:border-sky-300"
                  )}
                >
                  {idx + 1}
                  {flags[q.id] && currentIdx !== idx && (
                    <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-amber-500 rounded-bl" />
                  )}
                </button>
              ))}
            </div>
            <div className="px-3 py-2 border-t border-slate-200 flex flex-wrap gap-3 text-[10px] text-slate-500">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-50 border border-emerald-300" />
                Answered
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-50 border border-amber-300" />
                Flagged
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-sky-500 border border-sky-500" />
                Current
              </span>
            </div>
            <div className="p-3 border-t border-slate-200">
              <button
                onClick={() => {
                  setIsPaletteOpen(false);
                  setIsConfirmFinishOpen(true);
                }}
                disabled={isSubmitting}
                className="w-full h-9 bg-tertiary text-white rounded-md font-poppins font-medium text-sm hover:bg-tertiary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                Finish &amp; Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help / instructions modal — pulls directly from test.instructions */}
      {isHelpOpen && (
        <div className="fixed inset-0 z-[200] grid place-items-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setIsHelpOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-lg bg-white border border-slate-200 shadow-xl">
            <div className="flex items-center justify-between px-4 h-11 border-b border-slate-200 bg-sky-50">
              <h3 className="text-sm font-poppins font-semibold text-slate-900">
                Test instructions
              </h3>
              <button
                onClick={() => setIsHelpOpen(false)}
                className="w-8 h-8 inline-flex items-center justify-center rounded-md hover:bg-white transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-slate-600" />
              </button>
            </div>
            <div className="p-4 space-y-3 text-[13px] text-slate-700 font-lora leading-relaxed max-h-[60vh] overflow-y-auto">
              {test.instructions ? (
                <div className="prose prose-sm max-w-none prose-slate">
                  <MarkdownRenderer content={test.instructions} />
                </div>
              ) : (
                <p className="text-slate-500">
                  No instructions were set for this test. Default rules apply:
                </p>
              )}
              <ul className="list-disc pl-5 space-y-1 text-slate-600 text-[12px]">
                <li>Use the number palette to jump between questions.</li>
                <li>
                  The Review (flag) button lets you come back to tricky
                  questions later.
                </li>
                <li>
                  Switching tabs, copying, or right-clicking is treated as a
                  violation. Six violations will auto-submit the test.
                </li>
                <li>Your answers are saved automatically as you navigate.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Finish confirmation — prevents accidental submission */}
      {isConfirmFinishOpen && (
        <div className="fixed inset-0 z-[210] grid place-items-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/50"
            onClick={() => !isSubmitting && setIsConfirmFinishOpen(false)}
          />
          <div className="relative w-full max-w-sm rounded-lg bg-white border border-slate-200 shadow-xl p-5 text-center space-y-4">
            <div className="w-11 h-11 rounded-full bg-amber-50 border border-amber-200 text-amber-600 mx-auto grid place-items-center">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-poppins font-semibold text-slate-900">
                Finish your test?
              </h3>
              <p className="text-[13px] text-slate-600">
                You have answered{" "}
                <span className="font-semibold text-slate-900 tabular-nums">
                  {answeredCount}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-slate-900 tabular-nums">
                  {questions.length}
                </span>{" "}
                questions. Unanswered questions will be marked as incorrect.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsConfirmFinishOpen(false)}
                disabled={isSubmitting}
                className="flex-1 h-9 rounded-md bg-slate-100 text-slate-900 text-sm font-poppins font-medium hover:bg-slate-200 disabled:opacity-50 transition-colors"
              >
                Keep working
              </button>
              <button
                onClick={() => {
                  setIsConfirmFinishOpen(false);
                  handleSubmit("submitted");
                }}
                disabled={isSubmitting}
                className="flex-1 h-9 rounded-md bg-tertiary text-white text-sm font-poppins font-medium hover:bg-tertiary/90 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? <Spinner className="w-4 h-4 text-white" /> : null}
                Finish test
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Submission Overlay */}
      {isFinished && (
        <div className="fixed inset-0 z-[300] bg-white/90 backdrop-blur-md flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-sky-100" />
              <div className="absolute inset-0 rounded-full border-4 border-sky-600 border-t-transparent animate-spin" />
            </div>
            <div>
              <h2 className="text-lg font-poppins font-semibold text-slate-900">
                Finishing Session
              </h2>
              <p className="text-sm text-slate-500">
                Your answers are being secured. Please do not close this window.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Toolbar button in the NUST-reference style: a stacked icon + short
 * text label on a light card. Two tones — default (neutral) and primary
 * (Save). Width is fixed so the button row reads as an even grid even
 * when a section mentions "Next Section" vs "Next".
 */
function ToolbarButton({
  icon,
  label,
  onClick,
  disabled,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "primary";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="min-w-[52px] h-12 px-1.5 inline-flex flex-col items-center justify-center gap-0.5 rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      style={
        tone === "primary"
          ? {
              backgroundColor: "#f0f9ff",
              borderColor: "#bae6fd",
              color: "#0369a1",
            }
          : {
              backgroundColor: "#ffffff",
              borderColor: "#e2e8f0",
              color: "#334155",
            }
      }
    >
      {icon}
      <span className="text-[10px] font-poppins font-medium leading-none whitespace-nowrap">
        {label}
      </span>
    </button>
  );
}

/**
 * Renders an illustration attached to a question. Used for all four
 * placements (top/right/bottom/inline) — `right` is sized smaller so it
 * mirrors the NUST "Photograph" panel while the other placements get
 * full width so diagrams and graphs stay readable.
 */
function QuestionImage({
  url,
  className,
}: {
  url: string;
  className?: string;
}) {
  return (
    <div
      className={cn("overflow-hidden rounded-md border", className)}
      style={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Question illustration"
        className="w-full h-auto max-h-[360px] object-contain block"
        draggable={false}
      />
    </div>
  );
}
