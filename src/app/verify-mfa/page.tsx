"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

function VerifyMfaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("");

  const userId = searchParams.get("uid");
  const returnTo = searchParams.get("returnTo") || "/dashboard";

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/verify-mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp, userId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      router.push(returnTo);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Verification failed";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    if (!userId) {
      setError("Missing user ID");
      toast.error("Missing user ID");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/resend-mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessage("OTP sent to your WhatsApp");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to resend OTP";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="w-full max-w-sm surface-card p-6 text-center">
          <h1 className="text-lg font-poppins font-semibold text-on-surface mb-1">
            Secure portal
          </h1>
          <p className="text-sm text-brand-accent mb-4">
            Authentication required to proceed.
          </p>
          <button
            onClick={() => router.push("/login")}
            className="w-full h-10 inline-flex items-center justify-center rounded-md bg-tertiary text-white text-sm font-poppins font-medium hover:bg-tertiary/90 transition-colors"
          >
            Go to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm">
        <header className="flex items-center gap-2 py-4 justify-center">
          <div className="w-7 h-7 rounded-md bg-tertiary flex items-center justify-center">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
            </svg>
          </div>
          <span className="text-on-surface font-poppins font-semibold text-base">Scientia</span>
        </header>

        <div className="surface-card p-5">
          <div className="text-center mb-4">
            <h1 className="text-lg font-poppins font-semibold text-on-surface mb-1">
              Verify access
            </h1>
            <p className="text-sm text-on-surface-variant">
              Enter the 6-digit code sent to your WhatsApp.
            </p>
          </div>

          {message && (
            <div
              className="mb-3 p-2.5 rounded-md border border-tertiary/20 bg-tertiary/5 text-on-surface text-xs flex items-start gap-2"
              role="status"
            >
              <svg className="w-4 h-4 text-tertiary shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">{message}</div>
            </div>
          )}

          {error && (
            <div
              className="mb-3 p-2.5 rounded-md border border-brand-accent/20 bg-brand-accent/5 text-on-surface text-xs flex items-start gap-2"
              role="alert"
            >
              <svg className="w-4 h-4 text-brand-accent shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">{error}</div>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-3">
            <div className="space-y-1.5">
              <label
                htmlFor="mfa-otp"
                className="block text-xs font-medium text-on-surface-variant"
              >
                6-digit code
              </label>
              <input
                id="mfa-otp"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                maxLength={6}
                className="w-full h-12 bg-surface-container-high border border-outline-variant/20 rounded-md px-3 text-center text-xl font-poppins font-semibold tracking-[0.6em] text-on-surface focus:border-tertiary focus:ring-1 focus:ring-tertiary transition-colors outline-none"
                required
                aria-label="6-digit MFA code"
                spellCheck={false}
                inputMode="numeric"
                pattern="[0-9]*"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-md bg-tertiary text-white text-sm font-poppins font-medium hover:bg-tertiary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying…</span>
                </>
              ) : (
                <>
                  <span>Confirm access</span>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </>
              )}
            </button>
          </form>

          <div className="mt-3 text-center">
            <button
              onClick={resendOtp}
              disabled={loading}
              className="text-xs text-tertiary hover:text-tertiary/80 font-medium transition-colors disabled:opacity-50"
            >
              Resend code
            </button>
          </div>
        </div>

        <footer className="py-3 text-center text-[11px] text-outline">
          © {new Date().getFullYear()} Scientia Prep
        </footer>
      </div>
    </div>
  );
}

export default function VerifyMfaPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="surface-card p-6 flex flex-col items-center gap-2.5 max-w-sm w-full">
            <div className="w-5 h-5 border-2 border-tertiary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-on-surface-variant">
              Initiating secure access…
            </span>
          </div>
        </div>
      }
    >
      <VerifyMfaContent />
    </Suspense>
  );
}
