"use client";

import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";

function OAuthContent() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const startOAuth = async () => {
      try {
        const msg =
          "Google OAuth requires configuration. Please register with your email or contact admin.";
        setError(msg);
        toast.error(msg);
        setLoading(false);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to start OAuth";
        setError(message);
        toast.error(message);
        setLoading(false);
      }
    };

    startOAuth();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="surface-card p-4 flex items-center gap-2.5">
          <div className="w-4 h-4 border-2 border-tertiary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-on-surface">Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <header className="flex items-center gap-2 py-4 justify-center">
          <svg className="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
          </svg>
          <span className="text-on-surface font-poppins font-semibold text-base">
            Scientia
          </span>
        </header>

        <div className="surface-card p-5 text-center">
          <h1 className="text-base font-poppins font-semibold text-on-surface mb-2">
            Google OAuth
          </h1>
          {error ? (
            <>
              <p className="text-sm text-red-500 mb-3">{error}</p>
              <a
                href="/login"
                className="inline-flex items-center justify-center h-9 px-4 rounded-md bg-tertiary text-white text-sm font-poppins font-medium hover:bg-tertiary/90 transition-colors"
              >
                Back to sign in
              </a>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function OAuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="surface-card p-4 flex items-center gap-2.5">
            <div className="w-4 h-4 border-2 border-tertiary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-on-surface">Loading…</span>
          </div>
        </div>
      }
    >
      <OAuthContent />
    </Suspense>
  );
}
