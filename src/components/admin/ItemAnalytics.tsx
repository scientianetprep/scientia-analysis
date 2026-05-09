"use client";

import { cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Users,
} from "lucide-react";

type QuestionStat = {
  id: string;
  text: string;
  subject: string;
  topic?: string;
  attempt_count: number;
  correct_rate: number;
};

type TestStat = {
  id: string;
  name: string;
  subject: string;
  attempt_count: number;
  avg_score: number;
  pass_rate: number;
};

type Props = {
  questionStats: QuestionStat[];
  testStats: TestStat[];
};

function RateBar({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  const color =
    pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-yellow-500" : "bg-red-500";
  const textColor =
    pct >= 70
      ? "text-green-500"
      : pct >= 40
      ? "text-yellow-500"
      : "text-red-500";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
        <div
          className={cn("h-full transition-all", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={cn(
          "text-[11px] font-poppins font-semibold tabular-nums w-8 text-right",
          textColor
        )}
      >
        {pct}%
      </span>
    </div>
  );
}

export function ItemAnalytics({ questionStats, testStats }: Props) {
  return (
    <div className="space-y-3">
      {/* Test-level stats */}
      <div className="surface-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-tertiary" />
          <div>
            <h3 className="text-sm font-poppins font-semibold text-on-surface">
              Test performance
            </h3>
            <p className="text-[11px] text-outline">
              Average scores and pass rates per test
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {testStats.length === 0 ? (
            <p className="text-xs text-on-surface-variant text-center py-4">
              No test attempts recorded yet.
            </p>
          ) : (
            testStats.map((test) => (
              <div
                key={test.id}
                className="p-3 rounded-md bg-surface-container-low border border-outline-variant/15 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-poppins font-semibold text-on-surface truncate">
                      {test.name}
                    </p>
                    <p className="text-[11px] text-outline mt-0.5">
                      {test.subject}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 text-[11px] text-on-surface-variant">
                    <Users className="w-3 h-3" />
                    {test.attempt_count}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[11px] font-medium text-outline mb-1">
                      Avg score
                    </p>
                    <RateBar rate={test.avg_score / 100} />
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-outline mb-1">
                      Pass rate
                    </p>
                    <RateBar rate={test.pass_rate / 100} />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Item-level stats */}
      <div className="surface-card p-4 space-y-3">
        <div>
          <h3 className="text-sm font-poppins font-semibold text-on-surface">
            Hardest questions
          </h3>
          <p className="text-[11px] text-outline">
            Sorted by lowest correct rate
          </p>
        </div>

        <div className="space-y-2">
          {questionStats.length === 0 ? (
            <p className="text-xs text-on-surface-variant text-center py-4">
              No question attempt data yet.
            </p>
          ) : (
            questionStats.map((q, idx) => {
              const pct = Math.round(q.correct_rate * 100);
              const Icon =
                pct >= 70 ? TrendingUp : pct >= 40 ? Minus : TrendingDown;
              const iconColor =
                pct >= 70
                  ? "text-green-500"
                  : pct >= 40
                  ? "text-yellow-500"
                  : "text-red-500";

              return (
                <div
                  key={q.id}
                  className="flex items-start gap-2.5 p-3 rounded-md bg-surface-container-low border border-outline-variant/15"
                >
                  <span className="w-6 shrink-0 text-center text-[11px] font-poppins font-medium text-outline tabular-nums pt-0.5">
                    #{idx + 1}
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-poppins font-medium text-on-surface line-clamp-2">
                      {q.text}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="text-[11px] text-outline">
                        {q.subject}
                      </span>
                      {q.topic && (
                        <>
                          <span className="text-outline/40">·</span>
                          <span className="text-[11px] text-outline">
                            {q.topic}
                          </span>
                        </>
                      )}
                      <span className="text-outline/40">·</span>
                      <span className="text-[11px] text-outline">
                        {q.attempt_count} attempts
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <RateBar rate={q.correct_rate} />
                    </div>
                  </div>

                  <Icon className={cn("w-4 h-4 shrink-0 mt-0.5", iconColor)} />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
