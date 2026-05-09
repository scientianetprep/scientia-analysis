"use client";
import { useState } from "react";
import { toast } from "sonner";
import {
  Coins,
  Lock,
  Loader2,
  ChevronLeft,
  PenTool,
  BookOpen,
  GraduationCap,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

const TYPE_CONFIG = {
  test: {
    label: "Test",
    Icon: PenTool,
    color: "text-amber-600",
    bg: "bg-amber-500/10",
    ring: "ring-amber-500/20",
  },
  lesson: {
    label: "Lesson",
    Icon: BookOpen,
    color: "text-blue-600",
    bg: "bg-blue-500/10",
    ring: "ring-blue-500/20",
  },
  course: {
    label: "Course",
    Icon: GraduationCap,
    color: "text-green-600",
    bg: "bg-green-500/10",
    ring: "ring-green-500/20",
  },
};

type Props = {
  contentType: "lesson" | "test" | "course";
  contentId: string;
  contentName: string;
  contentSubject?: string | null;
  creditCost: number;
  balance: number;
  backHref: string;
};

export function CreditConfirmGate({
  contentType,
  contentId,
  contentName,
  contentSubject,
  creditCost,
  balance,
  backHref,
}: Props) {
  const [unlocking, setUnlocking] = useState(false);
  const [done, setDone] = useState(false);

  const meta = TYPE_CONFIG[contentType];
  const canAfford = balance >= creditCost;
  const afterBalance = balance - creditCost;

  const handleUnlock = async () => {
    if (!canAfford || unlocking) return;
    setUnlocking(true);
    try {
      const res = await fetch("/api/credits/spend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType, contentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDone(true);
      toast.success(`${contentName} unlocked!`);
      // Hard-navigate to the same URL after a brief confirmation delay.
      // Using window.location instead of router.refresh() to avoid the
      // Next.js 16 Turbopack "headCacheNode in null" RSC cache bug that
      // occurs when the server component tree switches component types
      // (CreditConfirmGate → QuizEngine) during a soft refresh.
      setTimeout(() => {
        window.location.replace(window.location.href);
      }, 800);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to unlock");
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center gap-6">
      {/* Icon */}
      <div
        className={cn(
          "w-16 h-16 rounded-2xl grid place-items-center ring-2",
          meta.bg,
          meta.ring
        )}
      >
        {done ? (
          <CheckCircle2 className="w-7 h-7 text-green-500" />
        ) : (
          <Lock className={cn("w-7 h-7", meta.color)} />
        )}
      </div>

      {/* Title */}
      <div className="space-y-1 max-w-sm">
        {contentSubject && (
          <p className={cn("text-[11px] font-medium uppercase tracking-widest", meta.color)}>
            {contentSubject}
          </p>
        )}
        <h2 className="text-xl font-poppins font-bold text-on-surface leading-snug">
          {contentName}
        </h2>
        <p className="text-sm text-on-surface-variant">
          {done
            ? "Content unlocked! Loading…"
            : `This ${meta.label.toLowerCase()} requires credits to access.`}
        </p>
      </div>

      {!done && (
        <>
          {/* Credit breakdown card */}
          <div className="w-full max-w-xs rounded-xl border border-outline-variant/20 bg-surface-container-low overflow-hidden">
            <div className="px-4 py-3 bg-surface-container-high/40 border-b border-outline-variant/15">
              <p className="text-xs font-medium text-outline uppercase tracking-wide">
                Credit breakdown
              </p>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-on-surface-variant">Your balance</span>
                <span className="font-poppins font-semibold text-on-surface flex items-center gap-1.5 text-sm">
                  <Coins className="w-3.5 h-3.5 text-tertiary" />
                  {balance.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-on-surface-variant">
                  {meta.label} cost
                </span>
                <span
                  className={cn(
                    "font-poppins font-semibold flex items-center gap-1.5 text-sm",
                    meta.color
                  )}
                >
                  <Coins className="w-3.5 h-3.5" />
                  {creditCost.toLocaleString()}
                </span>
              </div>
              <div className="h-px bg-outline-variant/20" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-on-surface-variant">
                  {canAfford ? "Balance after" : "Still needed"}
                </span>
                <span
                  className={cn(
                    "font-poppins font-bold text-sm flex items-center gap-1.5",
                    canAfford ? "text-green-600" : "text-red-500"
                  )}
                >
                  <Coins className="w-3.5 h-3.5" />
                  {canAfford
                    ? afterBalance.toLocaleString()
                    : (creditCost - balance).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Action */}
          {canAfford ? (
            <button
              onClick={handleUnlock}
              disabled={unlocking}
              className={cn(
                "h-11 px-8 rounded-xl font-poppins font-semibold text-sm inline-flex items-center gap-2.5 transition-all",
                "bg-tertiary text-white hover:bg-tertiary/90 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
              )}
            >
              {unlocking ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Coins className="w-4 h-4" />
              )}
              {unlocking ? "Unlocking…" : `Unlock for ${creditCost} credits`}
            </button>
          ) : (
            <div className="w-full max-w-xs space-y-2">
              <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-600 font-medium">
                Insufficient credits — you need{" "}
                {(creditCost - balance).toLocaleString()} more
              </div>
              <p className="text-xs text-outline">
                Contact your administrator to top up your credit balance.
              </p>
            </div>
          )}

          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Go back
          </Link>
        </>
      )}
    </div>
  );
}
