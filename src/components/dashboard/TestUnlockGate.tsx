"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock, Loader2 } from "lucide-react";
import Link from "next/link";

/**
 * Password prompt shown on `/dashboard/tests/<id>` when the test row has
 * a non-empty `access_password`. Submits to /api/exam/unlock which drops
 * a path-scoped HttpOnly cookie; on success we refresh so the server
 * page re-checks the cookie and renders the quiz.
 */
export function TestUnlockGate({
  testId,
  testName,
  subject,
}: {
  testId: string;
  testName: string;
  subject: string | null;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/exam/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test_id: testId, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Incorrect password");
        toast.error(data.error ?? "Incorrect password");
        return;
      }
      toast.success("Test unlocked");
      // Refresh the server component so it re-reads cookies and renders
      // the quiz engine. We use replace so the unlock page doesn't live
      // in the back-button history.
      router.refresh();
    } catch (err) {
      console.error("[v0] unlock submit failed", err);
      setError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface">
      <div className="w-full max-w-sm space-y-5">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-11 h-11 rounded-md bg-tertiary/10 border border-tertiary/20 flex items-center justify-center">
            <Lock className="w-5 h-5 text-tertiary" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-poppins font-semibold text-on-surface tracking-tight">
              {testName}
            </h1>
            {subject && (
              <p className="text-xs text-outline">{subject}</p>
            )}
          </div>
          <p className="text-sm text-on-surface-variant text-pretty">
            This test requires a password. Ask your instructor for the code,
            then enter it below to begin.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="surface-card p-4 space-y-3"
          aria-describedby={error ? "unlock-error" : undefined}
        >
          <div>
            <label
              htmlFor="exam-password"
              className="text-[11px] font-medium text-on-surface-variant block mb-1"
            >
              Test password
            </label>
            <input
              id="exam-password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              placeholder="Enter code"
              className={[
                "w-full h-10 px-3 rounded-md bg-surface-container-high border",
                "text-sm outline-none focus:ring-1 transition-colors",
                error
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                  : "border-outline-variant/20 focus:border-tertiary focus:ring-tertiary",
              ].join(" ")}
            />
            {error && (
              <p
                id="unlock-error"
                role="alert"
                className="text-red-500 text-[11px] mt-1"
              >
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || password.length === 0}
            className="w-full h-10 rounded-md bg-tertiary text-on-tertiary text-sm font-poppins font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Unlocking…
              </>
            ) : (
              "Unlock test"
            )}
          </button>
        </form>

        <div className="text-center">
          <Link
            href="/dashboard/tests"
            className="text-xs text-outline hover:text-on-surface transition-colors"
          >
            Back to test series
          </Link>
        </div>
      </div>
    </div>
  );
}
