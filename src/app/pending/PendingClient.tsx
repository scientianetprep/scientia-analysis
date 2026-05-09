"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getFriendlyErrorMessage } from "@/lib/error-utils";

type ApplicationStatus = "pending" | "active" | "rejected";

const REFRESH_COOLDOWN_MS = 60 * 1000; // 1 minute cooldown for manual refresh

interface PendingClientProps {
  initialStatus: ApplicationStatus;
  userId: string;
  siteName?: string;
  logoUrl?: string | null;
}

export default function PendingClient({
  initialStatus,
  siteName = "Scientia Prep",
  logoUrl,
}: PendingClientProps) {
  const router = useRouter();
  const [status, setStatus] = useState<ApplicationStatus>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [countdownRemaining, setCountdownRemaining] = useState(5);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStatus = async (isManual = false) => {
    if (isManual) setLoading(true);

    try {
      const res = await fetch("/api/auth/profile-status", { cache: "no-store" });
      const data = await res.json();

      if (data.error || !data.userId) {
        toast.error("Session expired. Please sign in.");
        router.replace("/login?info=session_expired");
        return;
      }

      const profileStatus = data.status;
      const newStatus =
        profileStatus === "active" ? "active" :
        profileStatus === "rejected" ? "rejected" : "pending";

      if (newStatus !== status) {
        setStatus(newStatus);
        if (newStatus === "active") {
          toast.success("Your application has been approved.");
        }
      } else if (isManual) {
        toast.info("Status is still pending. We're reviewing as fast as we can.");
      }

      if (isManual) {
        setCooldownRemaining(REFRESH_COOLDOWN_MS);
      }
    } catch (err) {
      if (isManual) toast.error(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Slower background polling to reduce server load and jitter
  useEffect(() => {
    if (status === "pending" && !loading) {
      pollingTimeoutRef.current = setTimeout(() => {
        fetchStatus(false);
      }, 60000);
    }

    return () => {
      if (pollingTimeoutRef.current) clearTimeout(pollingTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, loading]);

  useEffect(() => {
    if (cooldownRemaining > 0) {
      const timer = setTimeout(() => setCooldownRemaining((c) => Math.max(0, c - 1000)), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownRemaining]);

  useEffect(() => {
    if (status === "active" && countdownRemaining > 0) {
      const timer = setTimeout(() => setCountdownRemaining((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    } else if (status === "active" && countdownRemaining === 0) {
      router.replace("/dashboard");
    }
  }, [status, countdownRemaining, router]);

  const handleRefresh = () => {
    if (cooldownRemaining > 0 || loading) return;
    fetchStatus(true);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login?signed_out=true");
  };

  const formatCooldown = (ms: number) => `${Math.floor(ms / 1000)}s`;

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="surface-card p-6 text-center space-y-4">
          {status === "active" ? (
            <>
              <div className="w-12 h-12 rounded-md bg-green-500/10 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <div className="space-y-1.5">
                <h1 className="text-lg font-poppins font-semibold text-on-surface">
                  You&apos;re approved
                </h1>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  Welcome to {siteName}. Your portal is ready.
                </p>
              </div>

              <div className="space-y-2">
                <div className="w-full bg-surface-container-high h-1 rounded-full overflow-hidden">
                  <div
                    className="bg-tertiary h-full transition-all duration-1000 ease-linear"
                    style={{ width: `${(countdownRemaining / 5) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-outline">
                  Entering dashboard in{" "}
                  <span className="font-medium text-tertiary tabular-nums">{countdownRemaining}s</span>
                </p>
              </div>

              <button
                onClick={() => router.replace("/dashboard")}
                className="w-full h-10 inline-flex items-center justify-center rounded-md bg-tertiary text-white text-sm font-poppins font-medium hover:bg-tertiary/90 transition-colors"
              >
                Access dashboard now
              </button>
            </>
          ) : status === "rejected" ? (
            <>
              <div className="w-12 h-12 rounded-md bg-brand-accent/10 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>

              <div className="space-y-1.5">
                <h1 className="text-lg font-poppins font-semibold text-on-surface">
                  Application update
                </h1>
                <p className="text-sm text-on-surface-variant leading-relaxed text-balance">
                  Thank you for your interest. Unfortunately, we&apos;re unable to approve your application at this time.
                </p>
              </div>

              <div className="p-3 rounded-md bg-surface-container-low border border-outline-variant/15 text-xs text-on-surface-variant leading-relaxed text-left">
                <p className="font-medium mb-1">Next steps</p>
                <p>
                  If you believe this is an error or wish to appeal, please contact our support team.
                </p>
              </div>

              <button
                onClick={handleLogout}
                className="w-full h-9 inline-flex items-center justify-center rounded-md border border-outline-variant/20 bg-transparent text-on-surface text-sm font-poppins font-medium hover:bg-surface-container-high transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-md bg-tertiary/10 flex items-center justify-center mx-auto relative">
                <div className="absolute inset-0 rounded-md border-2 border-tertiary/20 border-t-tertiary animate-spin" />
                <svg className="w-5 h-5 text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>

              <div className="space-y-1.5">
                <h1 className="text-lg font-poppins font-semibold text-on-surface">
                  Application pending
                </h1>
                <p className="text-sm text-on-surface-variant leading-relaxed text-balance">
                  Your profile is under review by our admin team.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={handleRefresh}
                  disabled={loading || cooldownRemaining > 0}
                  className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-md bg-tertiary text-white text-sm font-poppins font-medium hover:bg-tertiary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : cooldownRemaining > 0 ? (
                    <span>Wait {formatCooldown(cooldownRemaining)}</span>
                  ) : (
                    <>
                      <span>Refresh status</span>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </>
                  )}
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full h-9 text-xs font-medium text-outline hover:text-on-surface transition-colors"
                >
                  Sign out
                </button>
              </div>

              <p className="text-xs text-outline">
                Average review time: 12&ndash;24 hours.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
