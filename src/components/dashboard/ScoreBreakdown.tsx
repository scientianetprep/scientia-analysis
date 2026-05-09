"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";

type Answer = {
  question_id: string;
  selected: string | null;
};

type Question = {
  id: string;
  text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct: string;
  explanation?: string;
  topic?: string;
  subject?: string;
  image_url?: string | null;
  image_position?: "top" | "right" | "bottom" | "inline" | null;
};

type Props = {
  questions: Question[];
  answers: Answer[];
};

const OPT_LABELS = ["A", "B", "C", "D"] as const;

function getOptionText(q: Question, opt: string) {
  const map: Record<string, string> = {
    A: q.option_a,
    B: q.option_b,
    C: q.option_c,
    D: q.option_d,
  };
  return map[opt] ?? "";
}

export function ScoreBreakdown({ questions, answers }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const answerMap = Object.fromEntries(
    answers.map((a) => [a.question_id, a.selected])
  );

  // Per-topic stats
  const topicMap: Record<
    string,
    { total: number; correct: number; subject: string }
  > = {};

  for (const q of questions) {
    const key = q.topic || q.subject || "General";
    if (!topicMap[key])
      topicMap[key] = { total: 0, correct: 0, subject: q.subject ?? "" };
    topicMap[key].total++;
    if (answerMap[q.id] === q.correct) topicMap[key].correct++;
  }

  const topics = Object.entries(topicMap).sort(
    ([, a], [, b]) => a.correct / a.total - b.correct / b.total
  );

  return (
    <div className="space-y-3">
      {/* Per-topic breakdown */}
      <div className="surface-card p-4 space-y-3">
        <div>
          <h3 className="text-sm font-poppins font-semibold text-on-surface">
            Topic breakdown
          </h3>
          <p className="text-[11px] text-outline mt-0.5">
            Weakest topics appear first
          </p>
        </div>

        <div className="space-y-2">
          {topics.map(([topic, stats]) => {
            const rate = stats.total > 0 ? stats.correct / stats.total : 0;
            const pct = Math.round(rate * 100);
            const color =
              pct >= 70
                ? "bg-green-500"
                : pct >= 40
                ? "bg-yellow-500"
                : "bg-red-500";
            const textColor =
              pct >= 70
                ? "text-green-500"
                : pct >= 40
                ? "text-yellow-500"
                : "text-red-500";

            return (
              <div key={topic} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-poppins font-medium text-on-surface truncate">
                    {topic}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 ml-3 font-poppins font-semibold tabular-nums",
                      textColor
                    )}
                  >
                    {stats.correct}/{stats.total} ({pct}%)
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
                  <div
                    className={cn("h-full transition-all duration-500", color)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-question review */}
      <div className="space-y-2">
        <div>
          <h3 className="text-sm font-poppins font-semibold text-on-surface">
            Question review
          </h3>
          <p className="text-[11px] text-outline mt-0.5">
            Tap any question to see the correct answer and explanation
          </p>
        </div>

        {questions.map((q, idx) => {
          const selected = answerMap[q.id];
          const isCorrect = selected === q.correct;
          const isSkipped = !selected;
          const isExpanded = expandedId === q.id;

          return (
            <button
              key={q.id}
              onClick={() => setExpandedId(isExpanded ? null : q.id)}
              className={cn(
                "w-full text-left rounded-md border transition-colors overflow-hidden",
                isCorrect
                  ? "border-green-500/25 bg-green-500/5 hover:bg-green-500/10"
                  : isSkipped
                  ? "border-outline-variant/20 bg-surface-container-low hover:bg-surface-container-high"
                  : "border-red-500/25 bg-red-500/5 hover:bg-red-500/10"
              )}
            >
              {/* Row header */}
              <div className="flex items-center gap-2.5 p-3">
                <div className="shrink-0">
                  {isCorrect ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : isSkipped ? (
                    <MinusCircle className="w-4 h-4 text-outline" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-poppins font-medium text-outline mb-0.5 block">
                    Q{idx + 1}
                    {q.topic && ` · ${q.topic}`}
                  </span>
                  <div className="text-xs font-poppins text-on-surface line-clamp-2 prose prose-sm max-w-none prose-slate">
                    <MarkdownRenderer content={q.text} />
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-1.5">
                  {!isSkipped && (
                    <span
                      className={cn(
                        "w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-poppins font-semibold",
                        isCorrect
                          ? "bg-green-500 text-white"
                          : "bg-red-500 text-white"
                      )}
                    >
                      {selected}
                    </span>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5 text-outline" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-outline" />
                  )}
                </div>
              </div>

              {/* Expanded */}
              {isExpanded && (
                <div
                  className="border-t border-outline-variant/10 px-3 pt-3 pb-3 space-y-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  {q.image_url && (q.image_position === "top" || !q.image_position) && (
                    <QuestionImage url={q.image_url} />
                  )}

                  <div className={cn(
                    "flex gap-3",
                    q.image_url && q.image_position === "right" ? "flex-col sm:flex-row" : "flex-col"
                  )}>
                    <div className="flex-1 min-w-0 space-y-3">
                      {q.image_url && q.image_position === "inline" && (
                        <QuestionImage url={q.image_url} />
                      )}
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {OPT_LABELS.map((opt) => {
                          const text = getOptionText(q, opt);
                          const isCorrectOpt = opt === q.correct;
                          const isChosen = opt === selected;
                          return (
                            <div
                              key={opt}
                              className={cn(
                                "flex items-center gap-2 p-2 rounded-md text-xs transition-colors",
                                isCorrectOpt
                                  ? "bg-green-500/10 border border-green-500/25"
                                  : isChosen && !isCorrectOpt
                                  ? "bg-red-500/10 border border-red-500/25"
                                  : "bg-surface-container-high border border-transparent"
                              )}
                            >
                              <span
                                className={cn(
                                  "w-5 h-5 rounded-md flex items-center justify-center font-poppins font-semibold text-[11px] shrink-0",
                                  isCorrectOpt
                                    ? "bg-green-500 text-white"
                                    : isChosen && !isCorrectOpt
                                    ? "bg-red-500 text-white"
                                    : "bg-surface-container-highest text-outline"
                                )}
                              >
                                {opt}
                              </span>
                              <div className="text-on-surface leading-snug prose prose-sm max-w-none prose-slate">
                                <MarkdownRenderer content={text} />
                              </div>
                              {isCorrectOpt && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-auto shrink-0" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {q.image_url && q.image_position === "right" && (
                      <QuestionImage url={q.image_url} className="w-full sm:w-40 shrink-0" />
                    )}
                  </div>

                  {q.image_url && q.image_position === "bottom" && (
                    <QuestionImage url={q.image_url} />
                  )}

                  {q.explanation && (
                    <div className="p-2.5 rounded-md bg-surface-container-high border-l-2 border-tertiary space-y-0.5">
                      <p className="text-[11px] font-poppins font-medium text-tertiary">
                        Explanation
                      </p>
                      <div className="text-xs text-on-surface-variant leading-relaxed prose prose-sm max-w-none prose-slate">
                        <MarkdownRenderer content={q.explanation} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function QuestionImage({ url, className }: { url: string; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-md border border-outline-variant/15 bg-white", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Question illustration"
        className="w-full h-auto max-h-[300px] object-contain block"
      />
    </div>
  );
}
