"use client";

import { useState, useEffect } from "react";
import { Trophy, Filter, Loader2, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface Ranking {
  rank: number;
  name: string;
  score: number;
  isCurrent?: boolean;
}

export function Leaderboard({ currentUserId: _currentUserId }: { currentUserId?: string }) {
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"overall" | "test" | "winners">("overall");
  const [tests, setTests] = useState<{ id: string; name: string }[]>([]);
  const [selectedTest, setSelectedTest] = useState<string>("");
  const [winners, setWinners] = useState<
    { testName: string; winnerName: string; score: number; date: string }[]
  >([]);

  useEffect(() => {
    fetchTests();
    loadRankings();
  }, []);

  useEffect(() => {
    if (filter === "winners") {
      fetchWinners();
    } else {
      loadRankings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, selectedTest]);

  const fetchTests = async () => {
    try {
      const res = await fetch("/api/tests?limit=10");
      const data = await res.json();
      if (data.length > 0) {
        setTests(data);
        setSelectedTest(data[0].id);
      }
    } catch {}
  };

  const fetchWinners = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/leaderboard/history");
      const data = await res.json();
      // The route returns `{ error: ... }` on failure. Feeding that to
      // <winners>.map() crashes the whole page (bug #33). Defensively coerce
      // non-arrays to [] so the empty-state card renders instead.
      setWinners(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setWinners([]);
    } finally {
      setLoading(false);
    }
  };

  const loadRankings = async () => {
    setLoading(true);
    try {
      let url = "/api/leaderboard";
      if (filter === "test" && selectedTest) {
        url += `?testId=${selectedTest}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      setRankings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setRankings([]);
    } finally {
      setLoading(false);
    }
  };

  const top3 = rankings.slice(0, 3);
  const others = rankings.slice(3);

  const medalColor = (rank: number) =>
    rank === 1
      ? "text-amber-500 bg-amber-500/10"
      : rank === 2
      ? "text-slate-400 bg-slate-400/10"
      : "text-orange-700 bg-orange-700/10";

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-poppins font-semibold text-on-surface tracking-tight">
            Leaderboard
          </h2>
          <p className="text-sm text-on-surface-variant">
            Top scholars across the platform.
          </p>
        </div>

        <div className="inline-flex rounded-md bg-surface-container-high border border-outline-variant/15 p-0.5 self-start sm:self-center">
          {(["overall", "test", "winners"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={cn(
                "h-8 px-3 rounded-[5px] text-xs font-medium capitalize transition-colors",
                filter === k
                  ? "bg-tertiary text-white"
                  : "text-outline hover:text-on-surface"
              )}
            >
              {k === "overall" ? "Overall" : k === "test" ? "By test" : "Winners"}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="py-16 flex flex-col items-center justify-center gap-2 text-outline text-sm"
          >
            <Loader2 className="w-5 h-5 animate-spin text-tertiary/60" />
            Loading…
          </motion.div>
        ) : filter === "winners" ? (
          <motion.div
            key="winners"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
          >
            {winners.length > 0 ? (
              winners.map((winner, idx) => (
                <div
                  key={idx}
                  className="surface-card p-3 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-7 h-7 rounded-md bg-amber-500/10 grid place-items-center">
                      <Trophy className="w-4 h-4 text-amber-500" />
                    </div>
                    <span className="text-[10px] font-medium text-outline">
                      {new Date(winner.date).toLocaleDateString(undefined, {
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <h3 className="text-sm font-medium text-on-surface line-clamp-1">
                    {winner.testName}
                  </h3>
                  <div className="flex items-center justify-between pt-2 border-t border-outline-variant/10">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-5 h-5 rounded-full bg-surface-container-high grid place-items-center text-[10px] font-semibold text-on-surface">
                        {winner.winnerName.charAt(0)}
                      </div>
                      <span className="text-xs text-on-surface truncate">
                        {winner.winnerName}
                      </span>
                    </div>
                    <span className="text-sm font-poppins font-semibold text-tertiary tabular-nums">
                      {winner.score}%
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full surface-card py-10 text-center text-sm text-outline">
                No history recorded yet.
              </div>
            )}
          </motion.div>
        ) : rankings.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="surface-card py-10 text-center text-sm text-outline"
          >
            No data available yet.
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {filter === "test" && tests.length > 0 && (
              <div className="flex items-center gap-2 surface-card px-3 h-9">
                <Filter className="w-3.5 h-3.5 text-tertiary shrink-0" />
                <select
                  value={selectedTest}
                  onChange={(e) => setSelectedTest(e.target.value)}
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-on-surface outline-none"
                >
                  {tests.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Top 3 compact row */}
            {top3.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {top3.map((r) => (
                  <div
                    key={r.rank}
                    className={cn(
                      "surface-card p-3 flex flex-col items-center gap-1 text-center",
                      r.isCurrent && "ring-1 ring-tertiary"
                    )}
                  >
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full grid place-items-center text-sm font-poppins font-semibold",
                        medalColor(r.rank)
                      )}
                    >
                      {r.rank}
                    </div>
                    <div className="text-xs font-medium text-on-surface truncate w-full">
                      {r.name}
                    </div>
                    <div className="text-base font-poppins font-semibold text-on-surface tabular-nums">
                      {r.score}%
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Rest of the list */}
            <div className="surface-card overflow-hidden">
              <ul className="divide-y divide-outline-variant/10">
                {others.map((rank) => (
                  <li
                    key={rank.rank}
                    className={cn(
                      "flex items-center justify-between px-3 h-11 transition-colors hover:bg-surface-container-high",
                      rank.isCurrent && "bg-tertiary/5"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 text-xs font-poppins font-medium text-outline text-center tabular-nums">
                        {rank.rank}
                      </span>
                      <div className="w-7 h-7 rounded-full bg-surface-container-high border border-outline-variant/15 grid place-items-center text-outline shrink-0">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-on-surface truncate">
                          {rank.name}
                          {rank.isCurrent && (
                            <span className="ml-1.5 text-[10px] text-tertiary">
                              (you)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="text-sm font-poppins font-semibold text-on-surface tabular-nums">
                      {rank.score}%
                    </span>
                  </li>
                ))}
                {others.length === 0 && (
                  <li className="px-3 py-6 text-center text-xs text-outline">
                    Only top 3 scholars right now.
                  </li>
                )}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
