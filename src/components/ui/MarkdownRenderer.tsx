"use client";

import { FC, lazy, Suspense } from "react";

// Lazy-load the full MarkdownRenderer with all its heavy dependencies
// (react-markdown, rehype plugins, katex, etc.)
const MarkdownRendererImpl = lazy(() =>
  import("./MarkdownRendererImpl").then((mod) => ({ default: mod.MarkdownRenderer }))
);

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// Skeleton loader while Markdown renderer is loading
function MarkdownSkeleton({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="space-y-3">
        <div className="h-4 bg-surface-container rounded w-full animate-pulse" />
        <div className="h-4 bg-surface-container rounded w-5/6 animate-pulse" />
        <div className="h-4 bg-surface-container rounded w-4/5 animate-pulse" />
      </div>
    </div>
  );
}

/**
 * Wrapper that lazy-loads MarkdownRenderer
 *
 * By wrapping the renderer in lazy + dynamic import, we save ~64KB of KaTeX,
 * react-markdown, and related plugins from the initial bundle. These assets
 * load only when a page/component with Markdown actually needs to render.
 */
export function MarkdownRenderer({
  content,
  className,
}: MarkdownRendererProps) {
  return (
    <Suspense fallback={<MarkdownSkeleton className={className} />}>
      <MarkdownRendererImpl content={content} className={className} />
    </Suspense>
  );
}
