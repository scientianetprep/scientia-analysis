"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { createBrowserClientFn } from "@/lib/supabase/client";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CompletionButtonProps {
  lessonId: string;
  userId: string;
  initialCompleted: boolean;
  onSuccess?: () => void;
}

export function CompletionButton({ lessonId, userId, initialCompleted, onSuccess }: CompletionButtonProps) {
  const [isCompleted, setIsCompleted] = useState(initialCompleted);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const supabase = createBrowserClientFn();

  const handleComplete = async () => {
    if (isCompleted || loading || isPending) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("lesson_completions")
        .insert({
          user_id: userId,
          lesson_id: lessonId,
        });

      if (error) throw error;

      setIsCompleted(true);
      
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors: ["#4F8EF7", "#6BB1FA", "#97C9FB"],
      });

      toast.success("Lesson completed", {
        description: "Your progress has been saved.",
      });

      startTransition(() => {
        router.refresh();
      });

      if (onSuccess) onSuccess();
      
    } catch (error: any) {
      console.error("Completion error:", error);
      toast.error("Failed to sync progress", {
        description: error.message || "Please try again later.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleComplete}
      disabled={isCompleted || loading || isPending}
      className={cn(
        "inline-flex items-center gap-2 h-9 px-4 rounded-md font-poppins font-medium text-sm transition-colors",
        isCompleted
          ? "bg-green-500/10 text-green-500 border border-green-500/25 cursor-default"
          : "bg-tertiary text-white hover:bg-tertiary/90 active:bg-tertiary/80"
      )}
    >
      {loading || isPending ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Saving…
        </>
      ) : isCompleted ? (
        <>
          <CheckCircle2 className="w-4 h-4" />
          Completed
        </>
      ) : (
        "Mark as completed"
      )}
    </button>
  );
}
