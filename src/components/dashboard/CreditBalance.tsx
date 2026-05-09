"use client";
import { Coins, RefreshCw } from "lucide-react";
import { useCredits } from "@/hooks/useCredits";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function CreditBalance({ collapsed }: { collapsed?: boolean }) {
  const { balance, loading, refresh } = useCredits();
  const [spinning, setSpinning] = useState(false);

  const handleRefresh = async () => {
    setSpinning(true);
    await refresh();
    setTimeout(() => setSpinning(false), 600);
  };

  if (loading) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-md bg-tertiary/10 border border-tertiary/15",
        collapsed && "justify-center px-0"
      )}
      title={`${(balance ?? 0).toLocaleString()} credits`}
    >
      <div className="w-6 h-6 rounded-md bg-tertiary/15 grid place-items-center shrink-0">
        <Coins className="w-3.5 h-3.5 text-tertiary" />
      </div>
      {!collapsed && (
        <div className="flex-1 min-w-0">
          <p className="text-xs font-poppins font-semibold text-on-surface tabular-nums leading-tight">
            {(balance ?? 0).toLocaleString()}
          </p>
          <p className="text-[10px] text-outline leading-tight">credits</p>
        </div>
      )}
      {!collapsed && (
        <button
          onClick={handleRefresh}
          className="w-5 h-5 rounded grid place-items-center text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors"
          title="Refresh balance"
        >
          <RefreshCw className={cn("w-3 h-3", spinning && "animate-spin")} />
        </button>
      )}
    </div>
  );
}
