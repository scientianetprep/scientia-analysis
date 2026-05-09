"use client";

import { useState, useEffect } from "react";
import {
  Brain,
  AlertCircle,
  ChevronRight,
  Loader2,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

interface WeakArea {
  subject: string;
  topic: string;
  total: number;
  correct: number;
  accuracy: number;
}

export function WeakAreaAnalysis() {
  const [data, setData] = useState<WeakArea[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalysis();
  }, []);

  const fetchAnalysis = async () => {
    try {
      const res = await fetch("/api/user/analysis/weak-areas");
      const results = await res.json();
      // The route now always returns an array, but defend against legacy
      // responses ({error:"..."}) reaching the client during rollout.
      setData(Array.isArray(results) ? results : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="surface-card p-5 flex flex-col items-center justify-center gap-2 text-on-surface-variant min-h-[140px]">
        <Loader2 className="w-5 h-5 animate-spin text-tertiary/60" />
        <p className="text-xs">Analyzing your performance patterns…</p>
      </div>
    );
  }

  if (data.length === 0) return null;

  const weakAreas = data.filter((a) => a.accuracy < 70).slice(0, 3);
  const strongAreas = data.filter((a) => a.accuracy >= 85).slice(0, 2);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-tertiary" />
        <h3 className="text-sm font-poppins font-semibold text-on-surface">
          Smart insights
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Weak areas */}
        <div className="surface-card p-4 space-y-3 border-l-2 border-red-500/50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-red-500/10 rounded-md">
              <AlertCircle className="w-3.5 h-3.5 text-red-500" />
            </div>
            <div>
              <h4 className="text-xs font-poppins font-semibold text-on-surface">
                Priority focus
              </h4>
              <p className="text-[11px] text-outline">
                Topics needing immediate attention
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {weakAreas.length > 0 ? (
              weakAreas.map((area, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-md bg-surface-container-high border border-outline-variant/15 hover:border-red-500/25 transition-colors"
                >
                  <div className="flex justify-between items-start mb-1.5">
                    <div className="flex flex-col min-w-0">
                      <span className="text-[11px] font-poppins font-medium text-outline">
                        {area.subject}
                      </span>
                      <span className="text-xs font-poppins font-medium text-on-surface truncate">
                        {area.topic}
                      </span>
                    </div>
                    <span className="text-sm font-poppins font-semibold text-red-500 tabular-nums shrink-0 ml-2">
                      {area.accuracy}%
                    </span>
                  </div>
                  <div className="h-1 w-full bg-surface-container-highest rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 transition-all duration-500"
                      style={{ width: `${area.accuracy}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-on-surface-variant">
                Great job. No major weak areas detected yet.
              </p>
            )}
          </div>
        </div>

        {/* Recommendation */}
        <div className="surface-card p-4 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-tertiary/10 rounded-md">
                <Brain className="w-3.5 h-3.5 text-tertiary" />
              </div>
              <h4 className="text-xs font-poppins font-semibold text-on-surface">
                AI tutor suggestion
              </h4>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              Based on your recent scores, you&apos;re excelling in{" "}
              <span className="font-medium text-brand-primary">
                {strongAreas[0]?.topic || "General prep"}
              </span>
              . We recommend spending{" "}
              <span className="font-medium text-tertiary">45 min</span>{" "}
              reviewing{" "}
              <span className="font-medium text-red-500">
                {weakAreas[0]?.topic}
              </span>{" "}
              to boost your aggregate.
            </p>
          </div>

          <Link
            href="/dashboard/tests"
            className="flex items-center justify-between group text-xs font-poppins font-medium text-tertiary"
          >
            <span className="group-hover:underline">Start target practice</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
