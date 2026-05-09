"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Coins, Lock, Loader2 } from "lucide-react";
import { useCredits } from "@/hooks/useCredits";

type Props = {
  contentType: "lesson" | "test" | "course";
  contentId: string;
  creditCost: number;
  onUnlocked?: () => void;
  children: React.ReactNode;
};

export function CreditGate({
  contentType,
  contentId,
  creditCost,
  onUnlocked,
  children,
}: Props) {
  const { balance, refresh } = useCredits();
  const [unlocking, setUnlocking] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  if (unlocked || creditCost === 0) return <>{children}</>;

  const canAfford = (balance ?? 0) >= creditCost;

  const handleUnlock = async () => {
    setUnlocking(true);
    try {
      const res = await fetch("/api/credits/spend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType, contentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await refresh();
      setUnlocked(true);
      onUnlocked?.();
      toast.success("Content unlocked!");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to unlock");
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-4">
      <div className="w-14 h-14 rounded-full bg-tertiary/10 grid place-items-center">
        <Lock className="w-6 h-6 text-tertiary" />
      </div>
      <div>
        <h2 className="text-base font-poppins font-semibold text-on-surface">
          This content costs {creditCost} credits
        </h2>
        <p className="text-sm text-outline mt-1">
          Your balance:{" "}
          <span className="font-semibold text-on-surface">
            {balance ?? 0}
          </span>{" "}
          credits
        </p>
      </div>
      {canAfford ? (
        <button
          onClick={handleUnlock}
          disabled={unlocking}
          className="h-10 px-6 rounded-md bg-tertiary text-white font-poppins font-medium text-sm inline-flex items-center gap-2 hover:bg-tertiary/90 disabled:opacity-50"
        >
          {unlocking ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Coins className="w-4 h-4" />
          )}
          Unlock for {creditCost} credits
        </button>
      ) : (
        <div className="px-4 py-2.5 rounded-md bg-red-500/10 text-red-600 text-sm">
          You need {creditCost - (balance ?? 0)} more credits. Contact your
          administrator to top up.
        </div>
      )}
    </div>
  );
}
