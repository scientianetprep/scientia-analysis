"use client";

import { LiteVideoPlayer } from "./LiteVideoPlayer";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { createBrowserClientFn } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  Download,
  Lock,
  CheckCircle2,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import confetti from "canvas-confetti";

interface LessonRendererProps {
  type: "video" | "pdf" | "markdown" | "latex";
  content: string;
  lessonId?: string;
  userId?: string;
  onComplete?: () => void;
}

export function LessonRenderer({ type, content, lessonId, userId, onComplete }: LessonRendererProps) {
  const [downloadRequested, setDownloadRequested] = useState(false);
  const [requestStatus, setRequestStatus] = useState<"none" | "pending" | "approved" | "rejected">("none");
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    toast.error("Content protected", {
      description: "Saving or copying materials is restricted to protect academic integrity.",
    });
  };

  useEffect(() => {
    if (type === "markdown" || type === "latex") {
      const handleScroll = () => {
        if (!scrollRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        if (scrollTop + clientHeight >= scrollHeight - 50) {
          handleAutoComplete();
        }
      };

      const element = scrollRef.current;
      element?.addEventListener("scroll", handleScroll);
      return () => element?.removeEventListener("scroll", handleScroll);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }
  }, [type, content]);

  const handleAutoComplete = async () => {
    if (!lessonId || !userId) return;

    const supabase = createBrowserClientFn();

    try {
      const { error } = await supabase
        .from("lesson_completions")
        .insert({ user_id: userId, lesson_id: lessonId });

      if (error) {
        if (error.code === "23505") return;
        throw error;
      }

      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.8 },
        colors: ["#006B5E", "#BA1A1A", "#FFB4AB"],
      });
      toast.success("Progress synchronized", { description: "You've finished this module." });
      if (onComplete) onComplete();
    } catch (e) {
      console.error("Auto-completion error:", e);
    }
  };

  const handleRequestDownload = async () => {
    if (downloadRequested || !userId || !lessonId) return;

    setRequestStatus("pending");
    const supabase = createBrowserClientFn();

    try {
      const { error } = await supabase
        .from("download_requests")
        .insert({ user_id: userId, lesson_id: lessonId });

      if (error) {
        if (error.code === "23505") {
          setDownloadRequested(true);
          toast.info("Request already logged", {
            description: "You have already requested access. Please wait for review.",
          });
          setRequestStatus("none");
          return;
        }
        throw error;
      }

      setDownloadRequested(true);
      toast.success("Download request sent", {
        description: "Admin will review your request. Access will be shared via email if approved.",
      });
    } catch (err: unknown) {
      console.error("Request error:", err);
      const message = err instanceof Error ? err.message : "Failed to send request";
      toast.error("Failed to send request", { description: message });
    } finally {
      setRequestStatus("none");
    }
  };

  return (
    <div className="w-full select-none" onContextMenu={handleContextMenu}>
      {type === "video" && <LiteVideoPlayer url={content} onEnded={handleAutoComplete} />}

      {type === "pdf" && (
        <div className="space-y-4">
          <div className="relative rounded-sm overflow-hidden border border-outline-variant/15 bg-surface-container-low shadow-sm">
            <iframe
              src={`${content}#toolbar=0&navpanes=0&scrollbar=0`}
              className="w-full h-[60vh] md:h-[70vh]"
              title="Protected academic document"
            />
            <div className="absolute inset-0 bg-transparent" />
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-surface-container-low rounded-sm border border-outline-variant/15">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-sm bg-tertiary/10 flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4 text-tertiary" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-poppins font-medium text-on-surface">Protected view enabled</span>
                <span className="text-xs text-on-surface-variant">Document sharing is restricted.</span>
              </div>
            </div>

            <button
              onClick={handleRequestDownload}
              disabled={downloadRequested}
              className={cn(
                "inline-flex items-center gap-1.5 h-9 px-3 rounded-sm font-poppins font-medium text-sm transition-colors",
                downloadRequested
                  ? "bg-surface-container-high text-on-surface-variant cursor-default"
                  : "bg-tertiary text-white hover:bg-tertiary/90"
              )}
            >
              {requestStatus === "pending" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : downloadRequested ? (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {downloadRequested ? "Request pending" : "Request download"}
            </button>
          </div>
        </div>
      )}

      {(type === "markdown" || type === "latex") && (
        <div ref={scrollRef} className="scroll-smooth">
          <article className="prose prose-sm md:prose-base max-w-none prose-headings:font-poppins prose-headings:font-semibold prose-headings:text-on-surface prose-p:font-lora prose-p:text-on-surface-variant prose-p:leading-relaxed prose-strong:text-on-surface prose-strong:font-semibold prose-code:text-tertiary prose-code:bg-surface-container-high prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-a:text-tertiary prose-a:no-underline hover:prose-a:underline">
            <MarkdownRenderer content={content} />

            <div className="not-prose mt-6 pt-4 border-t border-outline-variant/15 flex items-center gap-2 text-sm text-on-surface-variant">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              <span>You&apos;ve reached the end of this module.</span>
            </div>
          </article>
        </div>
      )}

      {type !== "video" && type !== "pdf" && type !== "markdown" && type !== "latex" && (
        <div className="p-8 bg-surface-container-low rounded-sm border border-dashed border-outline-variant/30 flex flex-col items-center justify-center text-center">
          <AlertTriangle className="w-6 h-6 text-brand-accent mb-2" />
          <h2 className="text-sm font-poppins font-semibold text-on-surface">Incompatible content format</h2>
          <p className="text-xs text-on-surface-variant mt-1 max-w-xs">
            Please refresh or contact support if this content fails to load.
          </p>
        </div>
      )}
    </div>
  );
}
