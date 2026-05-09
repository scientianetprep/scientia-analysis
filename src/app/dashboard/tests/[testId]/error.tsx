"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw, ArrowLeft } from "lucide-react";

/**
 * Segment-level error boundary for /dashboard/tests/[testId].
 *
 * Before this boundary existed, any thrown RSC error (a PostgREST RLS
 * denial, a null deref in the session lookup, etc.) fell through to the
 * Next.js default "This page couldn't load" screen, which gave the user
 * no way to file a support ticket because they couldn't reach the
 * support form back on the login footer.
 *
 * We:
 *   1. log the error with a `[v0]` prefix so it's easy to grep in the
 *      production logs,
 *   2. render a branded error card,
 *   3. offer both Reload (calls the Next.js `reset` prop) and Back to
 *      Test Series affordances so the user is never stuck.
 */
export default function TestPageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[v0] /dashboard/tests/[testId] crashed:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 px-4 text-center">
      <div className="w-12 h-12 rounded-md bg-red-500/10 grid place-items-center">
        <AlertCircle className="w-6 h-6 text-red-500" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-poppins font-semibold text-on-surface">
          We couldn&apos;t open this test
        </h2>
        <p className="text-sm text-on-surface-variant max-w-sm mx-auto">
          Something went wrong loading the exam shell. Reload to try again, or
          head back to the test series.
        </p>
        {error.digest && (
          <p className="text-[11px] text-outline font-mono mt-1">
            ref: {error.digest}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 mt-1">
        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-tertiary text-white text-xs font-poppins font-medium hover:bg-tertiary/90 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reload
        </button>
        <Link
          href="/dashboard/tests"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-surface-container-high border border-outline-variant/20 text-xs font-poppins font-medium text-on-surface hover:bg-surface-container-highest transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to tests
        </Link>
      </div>
    </div>
  );
}
