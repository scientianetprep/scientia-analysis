"use client";

import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import {
  TrendingUp,
  Target,
  Activity,
  Zap,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PerformanceAnalyticsProps {
  data: { created_at: string; percentage: number; [key: string]: unknown }[];
}

export function PerformanceAnalytics({ data }: PerformanceAnalyticsProps) {
  // Honest empty state — no more "Trial 1…Trial 5" placeholder scores or a
  // fake "Top 8%" percentile. If the student has no scores yet we render a
  // dedicated empty-state card at the bottom and show zeros in the stat row.
  const safeData = data ?? [];
  const hasData = safeData.length > 0;

  const chartData = hasData
    ? safeData
        .map((d) => ({
          date: new Date(d.created_at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          }),
          score: d.percentage,
        }))
        .reverse()
    : [];

  const avgScore = hasData
    ? Math.round(
        safeData.reduce((acc, curr) => acc + curr.percentage, 0) / safeData.length
      )
    : 0;
  const bestScore = hasData
    ? Math.round(Math.max(...safeData.map((d) => d.percentage)))
    : 0;

  const stats = [
    {
      label: "Mastery index",
      value: hasData ? `${avgScore}%` : "—",
      icon: <Activity className="w-3.5 h-3.5" />,
      color: "text-tertiary",
      bg: "bg-tertiary/10",
    },
    {
      label: "Tests attempted",
      value: String(safeData.length),
      icon: <Target className="w-3.5 h-3.5" />,
      color: "text-brand-primary",
      bg: "bg-brand-primary/10",
    },
    {
      label: "Best score",
      value: hasData ? `${bestScore}%` : "—",
      icon: <Zap className="w-3.5 h-3.5" />,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
    },
    {
      label: "Consistency",
      value: hasData && safeData.length >= 3 ? "Tracking" : "—",
      icon: <BarChart3 className="w-3.5 h-3.5" />,
      color: "text-green-500",
      bg: "bg-green-500/10",
    },
  ];

  return (
    <div className="space-y-3">
      {/* Stat grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {stats.map((stat, i) => (
          <div key={i} className="surface-card p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className={cn("p-1.5 rounded-md", stat.bg, stat.color)}>
                {stat.icon}
              </div>
              <span className="text-[11px] font-poppins font-medium text-outline">
                {stat.label}
              </span>
            </div>
            <p className="text-lg font-poppins font-semibold text-on-surface tabular-nums">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="surface-card p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-tertiary" />
            <div>
              <h3 className="text-sm font-poppins font-semibold text-on-surface">
                Academic trajectory
              </h3>
              <p className="text-[11px] text-outline">
                Tracing your performance over time
              </p>
            </div>
          </div>
        </div>

        {!hasData ? (
          <div className="h-56 w-full flex flex-col items-center justify-center gap-2 text-center">
            <div className="w-8 h-8 rounded-md bg-surface-container-high grid place-items-center text-outline">
              <TrendingUp className="w-4 h-4" />
            </div>
            <p className="text-sm font-poppins font-medium text-on-surface">
              No data yet
            </p>
            <p className="text-[11px] text-outline max-w-xs leading-relaxed">
              Take your first test and your trajectory will show up here.
            </p>
          </div>
        ) : (
        <div className="h-56 w-full -ml-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 8, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#006B5E" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#006B5E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="4 4"
                vertical={false}
                stroke="#8e918f"
                opacity={0.15}
              />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748b", fontSize: 11 }}
                dy={8}
              />
              <YAxis
                domain={[0, 100]}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748b", fontSize: 11 }}
                dx={-6}
                width={30}
              />
              <Tooltip
                cursor={{
                  stroke: "#006B5E",
                  strokeWidth: 1,
                  strokeDasharray: "4 4",
                }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="p-2.5 bg-surface border border-outline-variant/30 rounded-md shadow-lg">
                        <p className="text-[11px] text-outline mb-0.5">
                          {payload[0].payload.date}
                        </p>
                        <p className="text-sm font-poppins font-semibold text-tertiary tabular-nums">
                          {payload[0].value}% mastery
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="score"
                stroke="#006B5E"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorScore)"
                animationDuration={1500}
                activeDot={{
                  r: 5,
                  stroke: "#fff",
                  strokeWidth: 2,
                  fill: "#006B5E",
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        )}
      </div>
    </div>
  );
}
