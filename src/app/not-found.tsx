"use client";

import Link from "next/link";
import { AlertTriangle, Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface text-on-surface">
      <div className="w-full max-w-sm mx-auto">
        <div className="surface-card p-6 flex flex-col items-center text-center gap-4">
          <div className="w-12 h-12 bg-brand-accent/10 rounded-md flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-brand-accent" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-2xl font-poppins font-semibold text-on-surface">404</h1>
            <h2 className="text-sm font-poppins font-medium text-on-surface-variant">
              Page not found
            </h2>
            <p className="text-xs text-outline leading-relaxed">
              The page you&apos;re looking for has been moved, deleted, or does not exist.
            </p>
          </div>

          <div className="w-full flex flex-col gap-2 pt-1">
            <button
              onClick={() => window.history.back()}
              className="w-full h-9 inline-flex items-center justify-center gap-2 rounded-md text-sm font-poppins font-medium bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface transition-colors border border-outline-variant/20"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Go back
            </button>

            <Link
              href="/dashboard"
              className="w-full h-9 inline-flex items-center justify-center gap-2 rounded-md text-sm font-poppins font-medium bg-tertiary text-white hover:bg-tertiary/90 transition-colors"
            >
              <Home className="w-3.5 h-3.5" />
              Dashboard
            </Link>
          </div>
        </div>

        <div className="mt-3 text-center text-[11px] text-outline">
          Scientia Prep
        </div>
      </div>
    </div>
  );
}
