"use client";

import { createBrowserClient } from "@/lib/supabase/client";
import {
  Send,
  MessageSquare,
  Star,
  Loader2,
  Heart,
  AlertCircle,
} from "lucide-react";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function FeedbackPage() {
  const [isPending, startTransition] = useTransition();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);

  const supabase = createBrowserClient();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (rating === 0) {
      toast.error("Please provide a rating");
      return;
    }

    const formData = new FormData(e.currentTarget);
    const feedback = formData.get("feedback") as string;
    const category = formData.get("category") as string;

    startTransition(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const res = await fetch("/api/mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "feedback",
          to: user.email,
          data: {
            from: user.email,
            rating,
            category,
            feedback,
          },
        }),
      });

      if (!res.ok) {
        toast.error("Failed to send feedback over network.");
        return;
      }

      toast.success("Thanks! Your feedback has been sent to the team.");
      (e.target as HTMLFormElement).reset();
      setRating(0);
    });
  };

  return (
    <div className="max-w-2xl space-y-4 pb-10">
      <header className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-md bg-tertiary/10 flex items-center justify-center shrink-0">
          <Heart className="w-5 h-5 text-tertiary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-poppins font-semibold tracking-tight text-on-surface text-balance">
            How are we doing?
          </h1>
          <p className="text-sm text-on-surface-variant">
            Your insights help us build a better learning experience.
          </p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="surface-card p-4 space-y-4">
        {/* Rating */}
        <div className="space-y-2">
          <label className="block text-xs font-poppins font-medium text-on-surface-variant">
            Rate your overall experience
          </label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                onClick={() => setRating(star)}
                className="transition-transform active:scale-95"
                aria-label={`${star} star${star > 1 ? "s" : ""}`}
              >
                <Star
                  className={cn(
                    "w-7 h-7 transition-colors",
                    (hoveredRating || rating) >= star
                      ? "fill-tertiary text-tertiary"
                      : "text-outline-variant"
                  )}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Category */}
        <div className="space-y-2">
          <label className="block text-xs font-poppins font-medium text-on-surface-variant">
            Message type
          </label>
          <div className="grid grid-cols-2 gap-2">
            {["Suggestion", "Bug Report", "UI/UX", "Content"].map((cat) => (
              <label key={cat} className="relative cursor-pointer">
                <input
                  type="radio"
                  name="category"
                  value={cat}
                  defaultChecked={cat === "Suggestion"}
                  className="peer sr-only"
                />
                <div className="h-9 px-3 inline-flex items-center justify-center w-full rounded-md bg-surface-container-low border border-outline-variant/15 text-xs font-poppins font-medium text-outline peer-checked:bg-tertiary/5 peer-checked:border-tertiary peer-checked:text-tertiary transition-colors">
                  {cat}
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Message */}
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-poppins font-medium text-on-surface-variant">
            <MessageSquare className="w-3.5 h-3.5" /> Your message
          </label>
          <textarea
            name="feedback"
            required
            rows={5}
            placeholder="Tell us what's on your mind…"
            className="w-full p-3 rounded-md bg-surface-container-high border border-outline-variant/20 focus:border-tertiary focus:ring-1 focus:ring-tertiary outline-none transition-colors text-sm resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-md bg-tertiary text-white text-sm font-poppins font-medium hover:bg-tertiary/90 transition-colors disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              Send feedback
              <Send className="w-3.5 h-3.5" />
            </>
          )}
        </button>

        <div className="flex items-start gap-2 p-2.5 rounded-md bg-orange-500/5 border border-orange-500/15">
          <AlertCircle className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-on-surface-variant leading-relaxed">
            Your feedback will be sent directly to our academic team at Scientia.
          </p>
        </div>
      </form>
    </div>
  );
}
