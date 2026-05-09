"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ShieldAlert, Loader2, Check, Send } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [stage, setStage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const requestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Email required.");
      document.getElementById("reset-email")?.focus();
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/auth/reset-password/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.retry) {
          setError("Connection problem. Check your internet and try again.");
          setLoading(false);
          return;
        }
        throw new Error(data.error || "Failed to send recovery code");
      }

      setStage(2);
      setMessage("Verification code sent. Check your inbox (and spam).");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to send recovery code.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const confirmReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (otp.length !== 6) {
      toast.error("Enter the 6-digit recovery code.");
      document.getElementById("reset-otp")?.focus();
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      document.getElementById("new-password")?.focus();
      return;
    }

    setLoading(true);
    setError("");

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
      const msg =
        "Password must be 8+ chars with an uppercase letter and a number.";
      setError(msg);
      toast.error(msg);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/reset-password/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.retry) {
          setError("Connection problem. Try again.");
          setLoading(false);
          return;
        }
        throw new Error(data.error || "Failed to reset password");
      }

      setStage(3);
      setMessage("");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to reset password.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      <header className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-md bg-tertiary grid place-items-center overflow-hidden relative">
          <Image src="/icon-192.png" alt="Scientia" fill className="object-cover" />
        </div>
        <span className="text-on-surface font-poppins font-semibold text-base">
          Scientia
        </span>
      </header>

      <div className="surface-card p-4 sm:p-5 space-y-3">
        <div>
          <h1 className="text-xl font-poppins font-semibold text-on-surface">
            {stage === 1 && "Reset password"}
            {stage === 2 && "New password"}
            {stage === 3 && "Password updated"}
          </h1>
          <p className="text-sm text-on-surface-variant">
            {stage === 1 && "Enter your email to receive a recovery code."}
            {stage === 2 && "Enter the 6-digit code and a new password."}
            {stage === 3 && "You can now sign in with the new password."}
          </p>
        </div>

        {error && (
          <div
            className="py-2 px-3 rounded-md border border-red-500/20 bg-red-500/5 text-red-600 text-xs font-medium flex items-start gap-2"
            role="alert"
          >
            <ShieldAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <div className="flex-1">{error}</div>
          </div>
        )}

        {message && stage === 2 && (
          <div
            className="py-2 px-3 rounded-md border border-tertiary/20 bg-tertiary/5 text-tertiary text-xs font-medium"
            role="status"
          >
            {message}
          </div>
        )}

        {stage === 1 && (
          <form onSubmit={requestReset} className="space-y-3">
            <div className="space-y-1">
              <label
                htmlFor="reset-email"
                className="block text-xs font-medium text-on-surface-variant px-0.5"
              >
                Email address
              </label>
              <input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                autoComplete="email"
                className="premium-input"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-md bg-tertiary text-white text-sm font-poppins font-medium inline-flex items-center justify-center gap-1.5 hover:bg-tertiary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Send recovery code
                </>
              )}
            </button>
          </form>
        )}

        {stage === 2 && (
          <form onSubmit={confirmReset} className="space-y-3">
            <div className="space-y-1">
              <label
                htmlFor="reset-otp"
                className="block text-xs font-medium text-on-surface-variant px-0.5"
              >
                6-digit recovery code
              </label>
              <input
                id="reset-otp"
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                maxLength={6}
                className="w-full h-12 text-center tracking-[0.6em] font-poppins font-semibold text-xl rounded-md bg-surface-container-high border border-outline-variant/20 focus:border-tertiary focus:ring-1 focus:ring-tertiary outline-none"
                required
              />
            </div>

            <div className="space-y-1 relative">
              <label
                htmlFor="new-password"
                className="block text-xs font-medium text-on-surface-variant px-0.5"
              >
                New password
              </label>
              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8+ chars, 1 uppercase, 1 number"
                autoComplete="new-password"
                className="premium-input pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-[1.8rem] text-outline hover:text-on-surface transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-md bg-tertiary text-white text-sm font-poppins font-medium inline-flex items-center justify-center gap-1.5 hover:bg-tertiary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating
                </>
              ) : (
                "Update password"
              )}
            </button>
          </form>
        )}

        {stage === 3 && (
          <div className="text-center py-3">
            <div className="w-12 h-12 rounded-md bg-green-500/10 text-green-600 grid place-items-center mx-auto mb-3">
              <Check className="w-5 h-5" />
            </div>
            <p className="text-sm text-on-surface-variant mb-4">
              Your password has been reset successfully.
            </p>
            <button
              onClick={() => router.push("/login")}
              className="w-full h-10 rounded-md bg-tertiary text-white text-sm font-poppins font-medium hover:bg-tertiary/90 transition-colors"
            >
              Continue to sign in
            </button>
          </div>
        )}

        {stage < 3 && (
          <p className="text-xs text-on-surface-variant text-center">
            Remembered your password?{" "}
            <a
              href="/login"
              className="text-tertiary font-medium hover:underline"
            >
              Back to sign in
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
