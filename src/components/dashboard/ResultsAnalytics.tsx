"use client";
import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from "recharts";

interface ResultsAnalyticsProps {
  correct: number;
  total: number;
}

export function ResultsAnalytics({ correct, total }: ResultsAnalyticsProps) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const incorrect = total - correct;
  
  const data = [
    { name: "Correct Answers", value: correct, color: "#10b981" },
    { name: "Incorrect Answers", value: incorrect, color: "#f43f5e" }
  ];

  if (!mounted)
    return (
      <div className="h-56 w-full animate-pulse bg-surface-container-high rounded-md" />
    );

  return (
    <div className="w-full h-56">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={56}
            outerRadius={84}
            stroke="none"
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <RechartsTooltip
            contentStyle={{
              backgroundColor: "#1C1B1F",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              color: "#fff",
              fontSize: "12px",
            }}
            itemStyle={{ color: "#fff", fontWeight: 500 }}
          />
          <Legend
            verticalAlign="bottom"
            height={28}
            formatter={(value) => (
              <span className="text-on-surface font-poppins text-xs">
                {value}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
