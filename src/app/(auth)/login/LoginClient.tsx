"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Eye, EyeOff, ArrowLeft, Loader2, AlertCircle, Info } from "lucide-react";
import { getFriendlyErrorMessage } from "@/lib/error-utils";
import { cn } from "@/lib/utils";
import { SupportForm } from "@/components/auth/SupportForm";

async function initiateGoogleLogin() {
  const res = await fetch("/api/auth/oauth-google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "login" }),
  });
  const data = await res.json();
  if (!res.ok || !data.url) throw new Error(data.error || "OAuth initiation failed");
  window.location.href = data.url;
}

type LoginMethod = "cnic" | "username" | "email" | "phone";

export function LoginContent({
  siteName = "Scientia Prep",
  logoUrl,
}: {
  siteName?: string;
  logoUrl?: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | React.ReactNode>("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("email");
  const [countryCode, setCountryCode] = useState("+92");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [mfaMode, setMfaMode] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaType, setMfaType] = useState<"totp" | "email">("totp");
  const [mfaEmail, setMfaEmail] = useState("");
  const [mfaUserId, setMfaUserId] = useState("");

  const registered = searchParams.get("registered") === "true";
  const signedOut = searchParams.get("signed_out") === "true";
  const sessionExpired = searchParams.get("info") === "session_expired";
  const redirectFrom = searchParams.get("redirect");
  const suspended = searchParams.get("suspended") === "true";
  const rejected = searchParams.get("rejected") === "true";
  const urlError = searchParams.get("error");
  const emailParam = searchParams.get("email");

  useEffect(() => {
    if (emailParam) {
      setIdentifier(emailParam);
      setLoginMethod("email");
    }
  }, [emailParam]);

  useEffect(() => {
    if (suspended) { setError(getFriendlyErrorMessage("suspended")); toast.error("Account Suspended"); }
    else if (rejected) { setError(getFriendlyErrorMessage("rejected")); toast.error("Application Rejected"); }
    else if (urlError) { const msg = getFriendlyErrorMessage(decodeURIComponent(urlError)); setError(msg); toast.error(msg); }
    else if (sessionExpired) { setError("Your session has expired. Please log in again."); toast.error("Session Expired"); }
    else if (signedOut) toast.info("Signed out successfully.");
    else if (redirectFrom === "pending") { setError("Please sign in to access your application status."); toast.error("Sign in required"); }

    if (registered) toast.success("Registration successful! You can now sign in.");
  }, [suspended, rejected, urlError, signedOut, sessionExpired, redirectFrom, registered]);

  useEffect(() => {
    if (loginMethod === "cnic") {
      const digits = identifier.replace(/\D/g, "");
      if (digits.length >= 5 && identifier.length < 6) {
        setIdentifier(digits.slice(0, 5) + "-" + digits.slice(5));
      } else if (digits.length >= 12 && identifier.length < 14) {
        const firstPart = digits.slice(0, 5);
        const secondPart = digits.slice(5, 12);
        const thirdPart = digits.slice(12);
        setIdentifier(firstPart + "-" + secondPart + "-" + thirdPart);
      }
    } else if (loginMethod === "phone") {
      const raw = identifier.replace(/\s+/g, "");
      if (raw.startsWith("+92")) {
        setCountryCode("+92");
        setIdentifier(raw.substring(3));
      } else if (raw.startsWith("0092")) {
        setCountryCode("+92");
        setIdentifier(raw.substring(4));
      } else if (raw.startsWith("0")) {
        setIdentifier(raw.substring(1));
      }
    }
  }, [identifier, loginMethod]);

  const handleMethodChange = (method: LoginMethod) => {
    setLoginMethod(method);
    setIdentifier("");
    setFieldErrors({});
    setError("");
  };

  const handleMfaVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mfaCode.length !== 6) return;
    setLoading(true);
    setError("");

    try {
      if (mfaType === "totp") {
        const { createBrowserClient } = await import("@/lib/supabase/client");
        const supabase = createBrowserClient();
        const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError) throw factorsError;
        const totpFactor = factors.totp[0];
        if (!totpFactor) throw new Error("No authenticator app enrolled");
        const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
          factorId: totpFactor.id,
        });
        if (challengeError) throw challengeError;
        const { error: verifyError } = await supabase.auth.mfa.verify({
          factorId: totpFactor.id,
          challengeId: challengeData.id,
          code: mfaCode,
        });
        if (verifyError) throw verifyError;
      } else {
        const res = await fetch("/api/auth/mfa/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: mfaUserId, code: mfaCode, email: mfaEmail }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Verification failed");
      }

      toast.success("Verification successful!");
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid code. Please try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendMfa = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/auth/resend-mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: mfaUserId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resend code");
      toast.success("Security code resent.");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setFieldErrors({});

    let hasErrors = false;
    const newErrors: Record<string, string> = {};

    if (!identifier) {
      newErrors.identifier = `Please enter your ${getMethodLabel(loginMethod)}.`;
      hasErrors = true;
    } else {
      if (loginMethod === "cnic" && identifier.replace(/\D/g, "").length !== 13) {
        newErrors.identifier = "CNIC must be exactly 13 digits.";
        hasErrors = true;
      }
      if (loginMethod === "username" && identifier.length < 4) {
        newErrors.identifier = "Username must be at least 4 characters.";
        hasErrors = true;
      }
      if (loginMethod === "phone" && identifier.replace(/\D/g, "").length < 10) {
        newErrors.identifier = "Phone number is too short.";
        hasErrors = true;
      }
      if (loginMethod === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
        newErrors.identifier = "Please enter a valid email address.";
        hasErrors = true;
      }
    }

    if (!password) {
      newErrors.password = "Your password is required.";
      hasErrors = true;
    }

    if (hasErrors) {
      setFieldErrors(newErrors);
      setLoading(false);
      return;
    }

    let finalIdentifier = identifier;
    if (loginMethod === "phone") {
      finalIdentifier = `${countryCode}${identifier.replace(/\D/g, "")}`;
    }

    try {
      const authPromise = fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: finalIdentifier, password, loginMethod }),
      }).then((res) => res.json().then((data) => ({ res, data })));

      const { res, data } = await authPromise;

      if (!res.ok) {
        if (data.retry) {
          const msg = getFriendlyErrorMessage("network_error");
          setError(msg);
          toast.error(msg);
          setLoading(false);
          return;
        }

        if (data.requiresEmailVerification) {
          setError(
            <div className="flex flex-col gap-1">
              <p>{getFriendlyErrorMessage(data.error)}</p>
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/register?info=verify_email&email=${encodeURIComponent(
                      data.email || ""
                    )}`
                  )
                }
                className="text-tertiary hover:underline font-medium text-left text-xs"
              >
                Resend verification email
              </button>
            </div>
          );
          setLoading(false);
          return;
        }

        throw new Error(data.error);
      }

      if (data.requiresMfa) {
        setMfaType(data.mfaType || "totp");
        if (data.mfaType === "email") {
          setMfaEmail(data.email);
          setMfaUserId(data.userId);
        }
        setMfaMode(true);
        return;
      }

      toast.success("Welcome back!");

      if (data.requiresWhatsapp) {
        router.push(`/register?resume=stage-3&uid=${data.userId}`);
        return;
      }
      if (data.requiresRegistration) {
        const stage = data.resumeStage || 2;
        router.push(`/register?resume=stage-${stage}&uid=${data.userId}`);
        return;
      }
      if (data.requiresApproval) {
        router.push("/pending");
        return;
      }

      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = getFriendlyErrorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const getPlaceholder = (): string => {
    switch (loginMethod) {
      case "cnic": return "12345-1234567-1";
      case "username": return "Your username";
      case "phone": return "03XXXXXXXXX";
      case "email":
      default: return "name@company.com";
    }
  };

  const getInputType = (): string => {
    switch (loginMethod) {
      case "email": return "email";
      case "phone": return "tel";
      default: return "text";
    }
  };

  const getMethodLabel = (method: LoginMethod): string => {
    const labels: Record<LoginMethod, string> = {
      cnic: "CNIC",
      username: "Username",
      phone: "Phone",
      email: "Email",
    };
    return labels[method];
  };

  const Header = ({ onBack }: { onBack?: () => void }) => (
    <header className="flex flex-col items-center text-center gap-4 mb-8">
      <div className="w-[100px] h-[100px] rounded-sm bg-tertiary grid place-items-center overflow-hidden relative border border-outline-variant/15 shadow-md">
        {logoUrl ? (
          <img src={logoUrl} alt={siteName} className="w-full h-full object-contain" />
        ) : (
          <span className="text-white font-poppins font-bold text-xl">
            {siteName.slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between w-full">
        <span className="text-on-surface font-poppins font-bold text-lg truncate">
          {siteName}
        </span>
        {onBack ? (
          <button
            onClick={onBack}
            className="h-8 px-2.5 rounded-md bg-surface-container-high text-on-surface-variant hover:text-tertiary text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
        ) : (
          <Link
            href="/"
            className="h-8 px-2.5 rounded-md bg-surface-container-high text-on-surface-variant hover:text-tertiary text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Link>
        )}
      </div>
    </header>
  );

  if (mfaMode) {
    return (
      <div className="w-full max-w-sm mx-auto">
        <Header onBack={() => { setMfaMode(false); setMfaCode(""); }} />

        <div className="space-y-3">
          <div>
            <h1 className="text-xl font-poppins font-semibold text-on-surface">
              {mfaType === "email" ? "Email verification" : "Authenticator app"}
            </h1>
            <p className="text-sm text-on-surface-variant">
              {mfaType === "email"
                ? `Enter the 6-digit code sent to ${mfaEmail.replace(
                    /(.{3})(.*)(@.*)/,
                    "$1...$3"
                  )}`
                : "Open your authenticator app and enter the 6-digit code."}
            </p>
          </div>

          <form
            onSubmit={handleMfaVerification}
            className="surface-card p-4 sm:p-5 space-y-3"
          >
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={mfaCode}
              onChange={(e) => {
                setMfaCode(e.target.value.replace(/\D/g, ""));
                setError("");
              }}
              className="w-full h-12 text-center tracking-[0.6em] font-poppins font-semibold text-xl rounded-md bg-surface-container-high border border-outline-variant/20 focus:border-tertiary focus:ring-1 focus:ring-tertiary outline-none"
              placeholder="000000"
              autoFocus
            />

            {error && (
              <div className="h-auto py-2 px-3 rounded-md border border-red-500/20 bg-red-500/5 text-red-600 text-xs font-medium flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <div>{error}</div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || mfaCode.length !== 6}
              className="w-full h-10 rounded-md bg-tertiary text-white text-sm font-poppins font-medium inline-flex items-center justify-center gap-1.5 hover:bg-tertiary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Verify code"
              )}
            </button>

            {mfaType === "email" && (
              <p className="text-xs text-outline text-center">
                Didn&apos;t receive the code?{" "}
                <button
                  type="button"
                  onClick={handleResendMfa}
                  className="text-tertiary hover:underline font-medium"
                >
                  Resend
                </button>
              </p>
            )}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      <Header />

      <div className="space-y-3">
        <div>
          <h1 className="text-xl font-poppins font-semibold text-on-surface">
            Welcome back
          </h1>
          <p className="text-sm text-on-surface-variant">
            Sign in to continue to your dashboard.
          </p>
        </div>

        <div className="surface-card p-4 sm:p-5 space-y-3">
          <div
            className="inline-flex flex-wrap gap-1 rounded-md bg-surface-container-high border border-outline-variant/15 p-0.5 w-full"
            role="radiogroup"
            aria-label="Select login method"
          >
            {(["email", "phone", "cnic", "username"] as LoginMethod[]).map(
              (method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => handleMethodChange(method)}
                  className={cn(
                    "h-7 flex-1 min-w-[60px] px-2 rounded-[5px] text-xs font-medium transition-colors",
                    loginMethod === method
                      ? "bg-tertiary text-white"
                      : "text-on-surface-variant hover:text-on-surface"
                  )}
                >
                  {getMethodLabel(method)}
                </button>
              )
            )}
          </div>

          <form
            onSubmit={handleLogin}
            noValidate
            className="space-y-3"
            aria-label="Login Form"
          >
            <div className="space-y-1">
              <label
                htmlFor="identifier-input"
                className="block text-xs font-medium text-on-surface-variant px-0.5"
              >
                {getMethodLabel(loginMethod)}
              </label>

              {loginMethod === "phone" ? (
                <div
                  className={cn(
                    "flex bg-surface-container-high border rounded-md overflow-hidden transition-colors",
                    fieldErrors.identifier
                      ? "border-red-500 focus-within:ring-1 focus-within:ring-red-500"
                      : "border-outline-variant/20 focus-within:ring-1 focus-within:ring-tertiary focus-within:border-tertiary"
                  )}
                >
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    aria-label="Country code"
                    className="bg-surface-container-low pl-2 pr-1 text-xs font-medium outline-none text-on-surface border-r border-outline-variant/20 cursor-pointer"
                  >
                    <option value="+92">PK (+92)</option>
                    <option value="+1">US (+1)</option>
                    <option value="+44">UK (+44)</option>
                    <option value="+971">UAE (+971)</option>
                  </select>
                  <input
                    id="identifier-input"
                    type="tel"
                    value={identifier}
                    onChange={(e) =>
                      setIdentifier(
                        e.target.value.replace(/\D/g, "").slice(0, 10)
                      )
                    }
                    placeholder="3XXXXXXXXX"
                    className="flex-1 bg-transparent h-9 px-3 outline-none text-sm text-on-surface placeholder:text-outline/50"
                    aria-invalid={!!fieldErrors.identifier}
                    spellCheck={false}
                  />
                </div>
              ) : (
                <input
                  id="identifier-input"
                  type={getInputType()}
                  value={identifier}
                  onChange={(e) => {
                    if (loginMethod === "cnic") {
                      setIdentifier(
                        e.target.value.replace(/[^\d-]/g, "").slice(0, 15)
                      );
                    } else {
                      setIdentifier(e.target.value);
                    }
                  }}
                  placeholder={getPlaceholder()}
                  className={cn(
                    "premium-input",
                    fieldErrors.identifier &&
                      "!border-red-500 focus:!ring-red-500"
                  )}
                  aria-invalid={!!fieldErrors.identifier}
                  spellCheck={false}
                />
              )}

              {fieldErrors.identifier && (
                <p
                  className="text-red-500 text-[11px] font-medium px-0.5"
                  role="alert"
                >
                  {fieldErrors.identifier}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between px-0.5">
                <label
                  htmlFor="password-input"
                  className="block text-xs font-medium text-on-surface-variant"
                >
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-[11px] font-medium text-tertiary hover:underline"
                >
                  Forgot?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password-input"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={cn(
                    "premium-input pr-9",
                    fieldErrors.password && "!border-red-500 focus:!ring-red-500"
                  )}
                  aria-invalid={!!fieldErrors.password}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              {fieldErrors.password && (
                <p
                  className="text-red-500 text-[11px] font-medium px-0.5"
                  role="alert"
                >
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {error && (
              <div
                className="py-2 px-3 rounded-md border border-red-500/20 bg-red-500/5 text-red-600 text-xs font-medium flex items-start gap-2"
                role="alert"
              >
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <div className="flex-1">{error}</div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-md bg-tertiary text-white text-sm font-poppins font-medium inline-flex items-center justify-center gap-1.5 hover:bg-tertiary/90 disabled:opacity-50 transition-colors"
              aria-busy={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Authenticating
                </>
              ) : (
                "Sign in"
              )}
            </button>

            <p className="text-xs text-on-surface-variant text-center">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="text-tertiary font-medium hover:underline"
              >
                Create account
              </Link>
            </p>
          </form>

          <div className="relative flex items-center py-0.5">
            <div className="flex-grow border-t border-outline-variant/15" />
            <span className="flex-shrink mx-2 text-outline text-[10px] font-medium">
              or
            </span>
            <div className="flex-grow border-t border-outline-variant/15" />
          </div>

          <button
            type="button"
            onClick={async () => {
              setLoading(true);
              setError("");
              try {
                await initiateGoogleLogin();
              } catch (err: unknown) {
                const msg = getFriendlyErrorMessage(err);
                setError(msg);
                toast.error(msg);
                setLoading(false);
              }
            }}
            disabled={loading}
            className="w-full h-10 rounded-md bg-surface-container-high border border-outline-variant/20 hover:bg-surface-container-highest transition-colors inline-flex items-center justify-center gap-2 text-sm font-medium"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </button>

          <div className="p-2.5 rounded-md border border-outline-variant/15 bg-surface-container-low text-[11px] text-on-surface-variant leading-relaxed flex gap-2">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-outline" />
            <p>
              <span className="font-medium text-on-surface">Trouble signing in?</span>{" "}
              Browser extensions or ad-blockers can interfere. Try an incognito
              window.
            </p>
          </div>
        </div>
      </div>

      <footer className="py-4 flex items-center justify-center gap-3 text-[10px] text-outline">
        <span>© {new Date().getFullYear()} {siteName}</span>
        <span className="w-1 h-1 rounded-full bg-outline/50" />
        <SupportForm />
      </footer>
    </div>
  );
}
