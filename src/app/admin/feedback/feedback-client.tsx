"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Star, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export function FeedbackClient({ initialFeedback }: { initialFeedback: any[] }) {
  const [filter, setFilter] = useState("all");

  const filtered = initialFeedback.filter((f) => {
    if (filter === "all") return true;
    if (filter === "high") return f.rating >= 4;
    if (filter === "low") return f.rating <= 2;
    return f.category === filter;
  });

  const chip = (id: string, label: string, activeClass: string) => (
    <button
      onClick={() => setFilter(id)}
      className={cn(
        "h-8 px-2.5 rounded-md text-xs font-medium transition-colors flex items-center",
        filter === id ? activeClass : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="surface-card p-2 flex flex-wrap gap-1.5">
        {chip("all", "All", "bg-tertiary text-white")}
        {chip("high", "High ratings", "bg-green-500 text-white")}
        {chip("low", "Needs attention", "bg-red-500 text-white")}
        {chip("bug", "Bugs", "bg-amber-500 text-white")}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {filtered.map((f) => (
          <div key={f.id} className="surface-card p-3 flex flex-col">
            <div className="flex items-center gap-1 mb-1.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={cn(
                    "w-3.5 h-3.5",
                    s <= f.rating ? "fill-amber-400 text-amber-400" : "text-outline-variant/30"
                  )}
                />
              ))}
              {f.category && (
                <span className="ml-1 inline-flex items-center h-5 px-1.5 rounded text-[10px] font-medium bg-surface-container-high text-on-surface-variant">
                  {f.category}
                </span>
              )}
            </div>

            <p className="font-lora text-sm text-on-surface leading-relaxed flex-1 mb-3">
              &ldquo;{f.message}&rdquo;
            </p>

            <div className="pt-2 border-t border-outline-variant/10 flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-surface-container-high grid place-items-center text-[11px] font-semibold text-tertiary border border-outline-variant/15">
                {f.profiles?.full_name?.[0] || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-on-surface truncate">
                  {f.profiles?.full_name || "Anonymous"}
                </div>
                <div className="text-[11px] text-outline">
                  {format(new Date(f.created_at), "MMM d, yyyy")}
                </div>
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full surface-card p-8 text-center">
            <MessageSquare className="w-6 h-6 text-outline mx-auto mb-2 opacity-40" />
            <p className="text-sm text-outline">No feedback entries for this filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
