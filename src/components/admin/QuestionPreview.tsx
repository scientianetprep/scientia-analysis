"use client";

import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";

type QuestionImagePosition = "right" | "top" | "bottom" | "inline";

interface QuestionPreviewProps {
  text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  image_url?: string | null;
  image_position?: QuestionImagePosition | null;
  marks?: number | null;
}

export function QuestionPreview({
  text,
  option_a,
  option_b,
  option_c,
  option_d,
  image_url,
  image_position = "right",
  marks,
}: QuestionPreviewProps) {
  const hasImage = !!image_url;
  const imgPos = image_position || "right";

  return (
    <div className="rounded-lg border bg-white p-4 md:p-5 space-y-4 shadow-sm text-slate-900 border-slate-200">
      {/* Simulation of the blue question band */}
      <div className="flex items-center justify-between -mx-4 -mt-4 px-4 py-1.5 bg-[#f0f9ff] border-b border-[#e0f2fe] rounded-t-lg mb-4">
        <span className="text-[11px] font-poppins text-slate-600">
          Question Preview {marks && `(${marks} Marks)`}
        </span>
      </div>

      {hasImage && imgPos === "top" && (
        <PreviewImage url={image_url!} />
      )}

      <div
        className={cn(
          "flex gap-4",
          hasImage && imgPos === "right"
            ? "flex-col md:flex-row md:items-start"
            : "flex-col"
        )}
      >
        <div className="flex-1 min-w-0">
          <div className="text-[15px] md:text-base leading-relaxed font-poppins prose prose-sm max-w-none prose-slate">
            <MarkdownRenderer content={text || "Question text will appear here..."} />
          </div>
        </div>
        {hasImage && imgPos === "right" && (
          <PreviewImage
            url={image_url!}
            className="w-full md:w-48 md:shrink-0"
          />
        )}
      </div>

      {hasImage && imgPos === "inline" && (
        <PreviewImage url={image_url!} />
      )}

      {/* Options */}
      <div className="space-y-2">
        {(["A", "B", "C", "D"] as const).map((letter) => {
          const optText = 
            letter === "A" ? option_a : 
            letter === "B" ? option_b : 
            letter === "C" ? option_c : 
            option_d;
          
          return (
            <div
              key={letter}
              className="w-full min-h-11 px-3 py-2.5 rounded-md border border-slate-200 bg-slate-50 flex items-center gap-3"
            >
              <span className="w-5 h-5 shrink-0 rounded-full border border-slate-300 bg-white flex items-center justify-center" />
              <span className="w-6 shrink-0 font-poppins font-semibold text-xs text-slate-500">
                {letter}.
              </span>
              <div className="text-sm flex-1 leading-snug font-poppins prose prose-sm max-w-none prose-slate">
                <MarkdownRenderer content={optText || `Option ${letter}`} />
              </div>
            </div>
          );
        })}
      </div>

      {hasImage && imgPos === "bottom" && (
        <PreviewImage url={image_url!} />
      )}
    </div>
  );
}

function PreviewImage({ url, className }: { url: string; className?: string }) {
  return (
    <div
      className={cn("overflow-hidden rounded-md border border-slate-200 bg-white", className)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Question illustration preview"
        className="w-full h-auto max-h-[300px] object-contain block"
      />
    </div>
  );
}
