"use client";

import { createBrowserClient } from "@/lib/supabase/client";
import {
  PenTool,
  Clock,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Hash,
  Search,
  Zap,
  Coins,
  Lock,
  KeyRound,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { TestGridSkeleton } from "@/components/dashboard/Skeletons";
import { Button } from "@/components/ui/button";

const SUBJECTS = ["All", "Physics", "Chemistry", "Math", "English"];

export default function TestsPage() {
  const [tests, setTests] = useState<any[]>([]);
  const [testStats, setTestStats] = useState<any>({});
  const [prices, setPrices] = useState<Record<string, { cost: number; free: boolean }>>({});
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [activeSubject, setActiveSubject] = useState("All");
  const [showMocksOnly, setShowMocksOnly] = useState(false);

  const supabase = createBrowserClient();

  useEffect(() => {
    async function fetchData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [testsRes, scoresRes, pricesRes, unlocksRes] = await Promise.all([
        supabase.from("tests").select("*").eq("is_published", true),
        supabase
          .from("scores")
          .select("test_id, percentage")
          .eq("user_id", user.id),
        supabase
          .from("content_prices")
          .select("content_id, credit_cost, is_free")
          .eq("content_type", "test"),
        supabase
          .from("content_unlocks")
          .select("content_id")
          .eq("user_id", user.id)
          .eq("content_type", "test"),
      ]);

      const testsData = testsRes.data || [];
      const scoresData = scoresRes.data || [];

      const stats = scoresData.reduce((acc: any, curr: any) => {
        if (!acc[curr.test_id]) acc[curr.test_id] = { attempts: 0, best: 0 };
        acc[curr.test_id].attempts += 1;
        acc[curr.test_id].best = Math.max(
          acc[curr.test_id].best,
          curr.percentage
        );
        return acc;
      }, {});

      // Build a map of testId → { cost, free }
      const priceMap: Record<string, { cost: number; free: boolean }> = {};
      for (const p of pricesRes.data ?? []) {
        priceMap[p.content_id] = { cost: p.credit_cost, free: p.is_free || p.credit_cost === 0 };
      }

      setTests(testsData);
      setTestStats(stats);
      setPrices(priceMap);
      setUnlockedIds(new Set((unlocksRes.data ?? []).map((u: any) => u.content_id)));
      setLoading(false);
    }
    fetchData();
  }, [supabase]);

  const filteredTests = tests.filter((test) => {
    const matchSubject =
      activeSubject === "All" ||
      test.subject?.toLowerCase() === activeSubject.toLowerCase();
    const matchMock = !showMocksOnly || test.is_mock === true;
    return matchSubject && matchMock;
  });

  return (
    <div className="space-y-5 md:space-y-6 animate-fade-in">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-poppins font-semibold tracking-tight">
            Test Series
          </h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Practice under real exam conditions.
          </p>
        </div>
        <div className="flex gap-1 overflow-x-auto no-scrollbar -mx-1 px-1">
          {SUBJECTS.map((sub) => (
            <button
              key={sub}
              onClick={() => setActiveSubject(sub)}
              className={cn(
                "h-7 px-3 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
                activeSubject === sub
                  ? "bg-tertiary text-white"
                  : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"
              )}
            >
              {sub}
            </button>
          ))}
          <button
            onClick={() => setShowMocksOnly(!showMocksOnly)}
            className={cn(
              "h-7 px-3 rounded-full text-xs font-medium transition-colors flex items-center gap-1 whitespace-nowrap",
              showMocksOnly
                ? "bg-brand-primary text-white"
                : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
            )}
          >
            <Zap className="w-3 h-3" /> Mock only
          </button>
        </div>
      </header>

      {loading ? (
        <TestGridSkeleton count={6} />
      ) : filteredTests.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredTests.map((test: any) => {
            const stats = testStats[test.id] || { attempts: 0, best: 0 };
            const isPassed = stats.best >= 50;
            const limited = test.max_attempts ? stats.attempts >= test.max_attempts : false;
            const priceInfo = prices[test.id];
            const creditCost = priceInfo?.cost ?? 0;
            const isExplicitlyFree = priceInfo?.free ?? false;
            const isUnlocked = unlockedIds.has(test.id);

            return (
              <div
                key={test.id}
                className={cn(
                  "rounded-lg border border-outline-variant/15 bg-surface-container-low p-4 flex flex-col gap-3 hover:border-tertiary/40 transition-colors",
                  limited && "opacity-60"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-md bg-tertiary/10 flex items-center justify-center shrink-0">
                      <PenTool className="w-4 h-4 text-tertiary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-on-surface truncate">
                        {test.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] text-outline">
                          {test.subject}
                        </span>
                        {test.is_mock && (
                          <span className="w-1 h-1 rounded-full bg-brand-primary" />
                        )}
                      </div>
                    </div>
                  </div>
                  {stats.attempts > 0 && (
                    <span
                      className={cn(
                        "h-5 px-2 rounded-full text-[11px] font-medium flex items-center gap-1 shrink-0",
                        isPassed
                          ? "bg-green-500/10 text-green-500"
                          : "bg-brand-accent/10 text-brand-accent"
                      )}
                    >
                      {isPassed ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <AlertCircle className="w-3 h-3" />
                      )}
                      {isPassed ? "Passed" : "Retake"}
                    </span>
                  )}
                  {/* Credit / free / unlocked badge */}
                  {isExplicitlyFree ? (
                    <span className="h-5 px-2 rounded-full text-[11px] font-medium flex items-center gap-1 shrink-0 bg-green-500/10 text-green-600">
                      FREE
                    </span>
                  ) : isUnlocked ? (
                    <span className="h-5 px-2 rounded-full text-[11px] font-medium flex items-center gap-1 shrink-0 bg-blue-500/10 text-blue-600">
                      <KeyRound className="w-3 h-3" />
                      Unlocked
                    </span>
                  ) : creditCost > 0 ? (
                    <span className="h-5 px-2 rounded-full text-[11px] font-medium flex items-center gap-1 shrink-0 bg-tertiary/10 text-tertiary">
                      <Coins className="w-3 h-3" />
                      {creditCost} cr
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center gap-4 text-xs text-outline">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {test.time_limit} min
                  </span>
                  <span className="flex items-center gap-1">
                    <Hash className="w-3 h-3" />
                    {test.question_ids?.length || 0} Q
                  </span>
                  {stats.attempts > 0 && (
                    <span className="ml-auto text-on-surface">
                      Best {Math.round(stats.best)}% · {stats.attempts}/{test.max_attempts || "∞"}
                    </span>
                  )}
                </div>

                <Link
                  href={limited ? "#" : `/dashboard/tests/${test.id}`}
                  className={cn(
                    "h-9 rounded-md text-sm font-medium flex items-center justify-center gap-1.5 transition-colors",
                    limited
                      ? "bg-surface-container-high text-outline cursor-not-allowed"
                      : "bg-tertiary text-white hover:bg-tertiary/90"
                  )}
                >
                  {limited
                    ? "Limit reached"
                    : stats.attempts > 0
                      ? "Retake"
                      : "Start"}
                  {!limited && <ChevronRight className="w-3.5 h-3.5" />}
                </Link>
              </div>
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
              No tests found
            </p>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Refine your filters or check back later.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setActiveSubject("All");
              setShowMocksOnly(false);
            }}
          >
            Reset filters
          </Button>
        </div>
      )}
    </div>
  );
}
