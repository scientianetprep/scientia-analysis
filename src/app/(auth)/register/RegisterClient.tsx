"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { getFriendlyErrorMessage } from "@/lib/error-utils";
import { SupportForm } from "@/components/auth/SupportForm";

async function initiateGoogleOAuth(mode: "register" | "login") {
  const res = await fetch("/api/auth/oauth-google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  const data = await res.json();
  if (!res.ok || !data.url) throw new Error(data.error || "OAuth initiation failed");
  window.location.href = data.url;
}

function formatCnic(val: string): string {
  const cleaned = val.replace(/\D/g, "");
  let formatted = cleaned;
  if (cleaned.length > 5) formatted = cleaned.slice(0, 5) + "-" + cleaned.slice(5);
  if (cleaned.length > 12) formatted = formatted.slice(0, 13) + "-" + formatted.slice(13, 14);
  return formatted.slice(0, 15);
}

const COUNTRY_CODES = [
  { name: "Pakistan", code: "+92", flag: "🇵🇰" },
  { name: "USA", code: "+1", flag: "🇺🇸" },
  { name: "UK", code: "+44", flag: "🇬🇧" },
  { name: "India", code: "+91", flag: "🇮🇳" },
];

export function RegisterContent({
  siteName = "Scientia Prep",
  logoUrl,
}: {
  siteName?: string;
  logoUrl?: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [stage, setStage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | React.ReactNode>("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [sessionChecked, setSessionChecked] = useState(false);
  const [sessionValid, setSessionValid] = useState(false);

  const [isGoogleUser, setIsGoogleUser] = useState(false);

  // Stage 1: Credentials
  const [email, setEmail] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  // Stage 2: Profile info
  const [userId, setUserId] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [cnic, setCnic] = useState("");
  const [city, setCity] = useState("");

  // Stage 3: WhatsApp verification
  const [phone, setPhone] = useState("");
  const [phonePrefix, setPhonePrefix] = useState("+92");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [whatsappOtpSent, setWhatsappOtpSent] = useState(false);

  // ── Verify session before allowing resume ───────────────────────────────────
  useEffect(() => {
    async function verifySession() {
      const uid = searchParams.get("uid");
      const resume = searchParams.get("resume");

      if (uid && resume) {
        setLoading(true);
        try {
          const res = await fetch(`/api/auth/profile-status?uid=${uid}`, {
            cache: "no-store",
          });
          const data = await res.json();

          const cleanResumeParams = () => {
            if (typeof window !== "undefined") {
              const clean = new URL(window.location.href);
              clean.searchParams.delete("uid");
              clean.searchParams.delete("resume");
              window.history.replaceState({}, "", clean.toString());
            }
          };

          if (data.error === "registration_expired") {
            setError(
              "Your previous registration window has ended. You can start a fresh registration below — it only takes a minute."
            );
            toast.error("Registration window ended");
            setStage(1);
            setUserId("");
            cleanResumeParams();
          } else if (data.error === "invalid_uid") {
            setStage(1);
            setUserId("");
            cleanResumeParams();
          } else if (data.error === "invalid_session") {
            router.replace("/login");
            return;
          } else if (data.requiresLogin) {
            router.replace("/login");
            return;
          } else {
            if (data.userId) setUserId(data.userId);
            const serverStage = typeof data.stage === "number" ? data.stage : 1;
            if (serverStage >= 4) {
              router.replace("/");
              return;
            }
            setSessionValid(true);
          }
        } catch {
          const msg = "Couldn't verify your registration. Please start again below.";
          setError(msg);
          toast.error(msg);
          setStage(1);
        } finally {
          setSessionChecked(true);
          setLoading(false);
        }
      } else {
        setSessionChecked(true);
      }
    }

    verifySession();
  }, [searchParams, router]);

  // ── Resume from OAuth callback or URL params ────────────────────────────
  useEffect(() => {
    if (!sessionChecked) return;

    const uid = searchParams.get("uid");
    const resume = searchParams.get("resume");
    const urlError = searchParams.get("error");
    const info = searchParams.get("info");
    const provider = searchParams.get("provider");

    if (urlError === "profile_create_failed") {
      const msg = getFriendlyErrorMessage("profile_create_failed");
      setError(msg);
      toast.error(msg);
    } else if (urlError) {
      const msg = getFriendlyErrorMessage(decodeURIComponent(urlError));
      setError(msg);
      toast.error(msg);
    }

    if (info === "complete_registration") {
      setMessage("Welcome! Please complete your registration to get started.");
    }

    if (provider === "google") {
      setIsGoogleUser(true);
    }

    if (uid && sessionValid) {
      setUserId(uid);
      if (resume === "stage-2") {
        setStage(2);
        if (!message) setMessage("Let's finish setting up your profile.");
      } else if (resume === "stage-3") {
        setStage(3);
        if (!message) setMessage("Almost there! Please verify your WhatsApp.");
      }
    }
  }, [searchParams, sessionChecked, sessionValid, message]);

  // ── Stage 1: Send email OTP ───────────────────────────────────────────────
  const sendEmailOtp = async () => {
    setFieldErrors({});
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldErrors({ email: "Please provide a valid email format." });
      document.getElementById("register-email")?.focus();
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/auth/register/stage-1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, action: "send-code" }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "email_exists" && data.loginUrl) {
          toast.error("Email already registered");
          setError(
            <div className="flex flex-col gap-2">
              <p>{getFriendlyErrorMessage("email_exists")}</p>
              <button
                type="button"
                onClick={() => router.push(data.loginUrl)}
                className="text-tertiary hover:underline font-semibold text-left"
              >
                Sign In Instead
              </button>
            </div>
          );
          return;
        }
        throw new Error(data.error);
      }
      setOtpSent(true);
      toast.success("Verification code sent to your email!");
      setMessage("A code has been sent to " + email);
    } catch (err: unknown) {
      const msg = getFriendlyErrorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const createAccount = async () => {
    setFieldErrors({});
    let hasError = false;
    const newErrors: Record<string, string> = {};

    if (emailOtp.length !== 6) {
      newErrors.emailOtp = "Please enter the 6-digit code sent to your email.";
      hasError = true;
    }
    if (password.length < 8) {
      newErrors.password = "Your password must be at least 8 characters long.";
      hasError = true;
    }
    if (password !== confirmPassword) {
      newErrors.confirmPassword = "Please ensure both password fields match.";
      hasError = true;
    }

    if (hasError) {
      setFieldErrors(newErrors);
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/auth/register/stage-1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: emailOtp, password, action: "verify-and-create" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUserId(data.userId);
      setStage(2);
      toast.success("Email verified successfully!");
    } catch (err: unknown) {
      const msg = getFriendlyErrorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    setFieldErrors({});
    let hasError = false;
    const newErrors: Record<string, string> = {};

    if (!fullName) {
      newErrors.fullName = "Please enter your legal name.";
      hasError = true;
    }
    if (!username || username.length < 4) {
      newErrors.username = "Username must be at least 4 characters.";
      hasError = true;
    }
    if (cnic.replace(/\D/g, "").length !== 13) {
      newErrors.cnic = "Please enter a valid 13-digit CNIC number.";
      hasError = true;
    }
    if (!city) {
      newErrors.city = "Please specify your city of residence.";
      hasError = true;
    }
    if (isGoogleUser && password.length < 8) {
      newErrors.googlePassword = "Please set a local password of at least 8 characters.";
      hasError = true;
    }
    if (isGoogleUser && password !== confirmPassword) {
      newErrors.googleConfirmPassword = "Ensure both local password fields match.";
      hasError = true;
    }

    if (hasError) {
       setFieldErrors(newErrors);
       return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/auth/register/stage-2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          full_name: fullName,
          username,
          cnic,
          city,
          ...(isGoogleUser && password ? { password } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStage(3);
      toast.success("Profile saved!");
    } catch (err: unknown) {
      const msg = getFriendlyErrorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const fullPhone = () => {
    const raw = phone.replace(/\D/g, "");
    const digits = raw.startsWith("0") ? raw.slice(1) : raw;
    return phonePrefix + digits;
  };

  const sendWhatsappOtp = async () => {
    setFieldErrors({});
    if (phone.replace(/\D/g, "").length < 10) {
      setFieldErrors({ phone: "Please enter a valid 10-digit number." });
      document.getElementById("whatsapp-number")?.focus();
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/auth/register/stage-3", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, phone: fullPhone(), action: "send" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.status === "ALREADY_VERIFIED") {
        setMessage("WhatsApp already verified. Your application is pending admin approval.");
        setStage(4);
        return;
      }
      setWhatsappOtpSent(true);
      toast.success("OTP sent to your WhatsApp!");
      setMessage("Check your WhatsApp for the code.");
    } catch (err: unknown) {
      const msg = getFriendlyErrorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const verifyWhatsapp = async () => {
    setFieldErrors({});
    if (phoneOtp.length !== 6) {
      setFieldErrors({ phoneOtp: "Please enter the 6-digit WhatsApp code." });
      document.getElementById("whatsapp-otp")?.focus();
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/auth/register/stage-3", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, phone: fullPhone(), otp: phoneOtp, action: "verify" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStage(4);
      toast.success("WhatsApp verified!");
    } catch (err: unknown) {
      const msg = getFriendlyErrorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await initiateGoogleOAuth("register");
    } catch (err: unknown) {
      const msg = getFriendlyErrorMessage(err);
      setError(msg);
      toast.error(msg);
      setLoading(false);
    }
  };

  if (loading && !sessionChecked) {
    return (
      <div className="w-full max-w-sm mx-auto surface-card p-6 text-center">
        <div className="animate-spin w-5 h-5 border-2 border-tertiary border-t-transparent rounded-full mx-auto mb-2" />
        <p className="text-sm text-on-surface-variant">Securing your session…</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <header className="flex flex-col items-center text-center gap-5 py-10">
        <div className="w-[100px] h-[100px] rounded-sm bg-tertiary flex items-center justify-center shadow-lg shadow-tertiary/20 overflow-hidden relative border border-outline-variant/15">
          {logoUrl ? (
            <img src={logoUrl} alt={siteName} className="w-full h-full object-contain" />
          ) : (
            <span className="text-white font-poppins font-bold text-xl">
              {siteName.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
        <span className="text-on-surface font-poppins font-bold tracking-tight text-2xl">
          {siteName}
        </span>
      </header>

      <main className="flex-1 py-2">
        <div className="w-full space-y-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-poppins font-bold">
              {stage === 1 && "Create Your Account"}
              {stage === 2 && "Profile Discovery"}
              {stage === 3 && "Secure Verification"}
              {stage === 4 && "Application Received"}
            </h1>
            <p className="text-on-surface-variant font-lora">
              {stage === 1 && "Join our premium educational ecosystem."}
              {stage === 2 && "Help us personalize your learning experience."}
              {stage === 3 && "Briefly verify your WhatsApp for secure access."}
              {stage === 4 && "You're all set! Awaiting administrative review."}
            </p>
          </div>

          {stage < 4 && (
            <div className="flex items-center justify-between w-full mb-4" role="progressbar">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center flex-1">
                  <div
                    className={`relative w-9 h-9 rounded-lg flex items-center justify-center font-semibold text-sm transition-colors ${
                      stage >= s
                        ? "bg-tertiary text-white"
                        : "bg-surface-container-high text-on-surface-variant"
                    }`}
                  >
                    {stage > s ? (
                      <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      s
                    )}
                  </div>
                  {s < 3 && (
                    <div
                      className={`flex-1 h-1 mx-2 rounded-full transition-all duration-500 ${
                        stage > s ? "bg-tertiary" : "bg-surface-container-high"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="glass-card p-6 md:p-8 space-y-6 animate-slide-up">
            {error && (
              <div className="p-4 rounded-xl border border-brand-accent/20 bg-brand-accent/5 text-on-surface text-sm font-lora flex items-start gap-3" role="alert">
                <svg className="w-5 h-5 text-brand-accent shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">{error}</div>
              </div>
            )}
            
            {message && !error && (
              <div className="p-4 rounded-xl border border-tertiary/20 bg-tertiary/5 text-on-surface text-sm font-lora flex items-start gap-3" role="status">
                <svg className="w-5 h-5 text-tertiary shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">{message}</div>
              </div>
            )}

            {stage === 1 && (
              <div className="space-y-8">
                <button
                  type="button"
                  onClick={handleGoogleRegister}
                  disabled={loading}
                  className="w-full h-10 rounded-md bg-surface-container-high border border-outline-variant/20 hover:bg-surface-container-highest transition-colors flex items-center justify-center gap-2 text-sm font-poppins font-medium"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Continue with Google
                </button>

                <div className="relative flex items-center py-0.5">
                  <div className="flex-grow border-t border-outline-variant/15" />
                  <span className="flex-shrink mx-2 text-outline text-[10px] font-medium">or</span>
                  <div className="flex-grow border-t border-outline-variant/15" />
                </div>

                <div className="space-y-6">
                  <div className="space-y-2.5">
                    <label htmlFor="register-email" className="block text-sm font-semibold text-on-surface-variant px-1">
                      Email Address
                    </label>
                    <input
                      id="register-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      className={`premium-input ${fieldErrors.email ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' : ''}`}
                      aria-invalid={!!fieldErrors.email}
                      aria-describedby={fieldErrors.email ? "email-error" : undefined}
                      spellCheck={false}
                    />
                    {fieldErrors.email && <p id="email-error" className="text-red-500 text-xs font-medium px-2">{fieldErrors.email}</p>}
                  </div>

                  {otpSent && (
                    <div className="space-y-6 animate-slide-up">
                      <div className="space-y-2.5">
                        <label htmlFor="email-otp" className="block text-sm font-semibold text-on-surface-variant px-1">
                          Verification Code
                        </label>
                        <input
                          id="email-otp"
                          type="text"
                          value={emailOtp}
                          onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, ""))}
                          placeholder="000 000"
                          maxLength={6}
                          className={`w-full h-12 text-center tracking-[0.6em] font-poppins font-semibold text-xl rounded-md bg-surface-container-high border border-outline-variant/20 focus:border-tertiary focus:ring-1 focus:ring-tertiary outline-none ${fieldErrors.emailOtp ? '!border-red-500 focus:!ring-red-500' : ''}`}
                          aria-invalid={!!fieldErrors.emailOtp}
                          aria-describedby={fieldErrors.emailOtp ? "email-otp-error" : undefined}
                        />
                        {fieldErrors.emailOtp && <p id="email-otp-error" className="text-red-500 text-xs font-medium px-2">{fieldErrors.emailOtp}</p>}
                      </div>

                      <div className="space-y-6 pt-2">
                        <div className="space-y-2.5">
                          <label htmlFor="register-password" title="Creation of Access" className="block text-sm font-semibold text-on-surface-variant px-1">
                            Create Password
                          </label>
                          <div className="relative group">
                            <input
                              id="register-password"
                              type={showPassword ? "text" : "password"}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="Min. 8 chars, 1 uppercase, 1 symbol"
                              className={`premium-input pr-12 ${fieldErrors.password ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                              aria-invalid={!!fieldErrors.password}
                              aria-describedby={fieldErrors.password ? "password-error" : undefined}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors focus:outline-none"
                              aria-label={showPassword ? "Hide password" : "Show password"}
                              aria-pressed={showPassword}
                            >
                              {showPassword ? (
                                <EyeOff className="w-5 h-5" />
                              ) : (
                                <Eye className="w-5 h-5" />
                              )}
                            </button>
                          </div>
                          {fieldErrors.password && <p id="password-error" className="text-red-500 text-xs font-medium px-2">{fieldErrors.password}</p>}
                        </div>

                        <div className="space-y-2.5">
                          <label htmlFor="register-confirm-password" className="block text-sm font-semibold text-on-surface-variant px-1">
                            Confirm Password
                          </label>
                          <div className="relative group">
                            <input
                              id="register-confirm-password"
                              type={showConfirmPassword ? "text" : "password"}
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder="Re-enter your password"
                              className="premium-input pr-12"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors focus:outline-none"
                              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                            >
                              {showConfirmPassword ? (
                                <EyeOff className="w-5 h-5" />
                              ) : (
                                <Eye className="w-5 h-5" />
                              )}
                            </button>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={createAccount}
                          disabled={loading}
                          className="w-full btn-premium"
                        >
                          {loading ? "Verifying..." : "Verify & Create Account"}
                        </button>
                      </div>
                    </div>
                  )}

                  {!otpSent && (
                    <button
                      type="button"
                      onClick={sendEmailOtp}
                      disabled={loading}
                      className="w-full btn-premium"
                    >
                      {loading ? "Sending..." : "Send Verification Code"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {stage === 2 && (
              <div className="space-y-6">
                <div className="space-y-2.5">
                  <label htmlFor="full-name" className="block text-sm font-semibold text-on-surface-variant px-1">
                    Full Name
                  </label>
                  <input
                    id="full-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your legal name"
                    className={`premium-input ${fieldErrors.fullName ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' : ''}`}
                  />
                  {fieldErrors.fullName && <p className="text-red-500 text-xs font-medium px-2">{fieldErrors.fullName}</p>}
                </div>

                <div className="space-y-2.5">
                  <label htmlFor="username" className="block text-sm font-semibold text-on-surface-variant px-1">
                    Username
                  </label>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="e.g. jdoe_scientia"
                    className={`premium-input ${fieldErrors.username ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' : ''}`}
                  />
                  {fieldErrors.username && <p className="text-red-500 text-xs font-medium px-2">{fieldErrors.username}</p>}
                </div>

                <div className="space-y-2.5">
                  <label htmlFor="cnic" className="block text-sm font-semibold text-on-surface-variant px-1">
                    CNIC Number
                  </label>
                  <input
                    id="cnic"
                    type="text"
                    value={cnic}
                    onChange={(e) => setCnic(formatCnic(e.target.value))}
                    placeholder="XXXXX-XXXXXXX-X"
                    className={`premium-input ${fieldErrors.cnic ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' : ''}`}
                  />
                  {fieldErrors.cnic && <p className="text-red-500 text-xs font-medium px-2">{fieldErrors.cnic}</p>}
                </div>

                <div className="space-y-2.5">
                  <label htmlFor="city" className="block text-sm font-semibold text-on-surface-variant px-1">
                    City
                  </label>
                  <input
                    id="city"
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Islamabad"
                    className={`premium-input ${fieldErrors.city ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' : ''}`}
                  />
                  {fieldErrors.city && <p className="text-red-500 text-xs font-medium px-2">{fieldErrors.city}</p>}
                </div>

                {isGoogleUser && (
                  <div className="space-y-4 animate-slide-up bg-surface-container-low/30 p-3 rounded-lg border border-outline-variant/15">
                    <p className="text-xs text-on-surface-variant px-1">Since you signed in with Google, please set a password for local access.</p>
                    <div className="space-y-2.5">
                      <label htmlFor="google-password" className="block text-sm font-semibold text-on-surface-variant px-1">Local Password</label>
                      <div className="relative group">
                        <input id="google-password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 chars" className="premium-input pr-12" />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors focus:outline-none"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      <label htmlFor="google-confirm-password" className="block text-sm font-semibold text-on-surface-variant px-1">Confirm Password</label>
                      <div className="relative group">
                        <input id="google-confirm-password" type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat password" className="premium-input pr-12" />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors focus:outline-none"
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={loading}
                  className="w-full btn-premium"
                >
                  {loading ? "Saving..." : "Save & Continue"}
                </button>
              </div>
            )}

            {stage === 3 && (
              <div className="space-y-8">
                <div className="space-y-2.5">
                  <label htmlFor="whatsapp-number" className="block text-sm font-semibold text-on-surface-variant px-1">WhatsApp Number</label>
                  <div className="flex gap-3">
                    <select
                      value={phonePrefix}
                      onChange={(e) => setPhonePrefix(e.target.value)}
                      disabled={whatsappOtpSent || loading}
                      className="h-10 px-2.5 bg-surface-container-highest border border-outline-variant/20 rounded-md text-sm text-on-surface font-medium focus:border-tertiary focus:ring-1 focus:ring-tertiary outline-none transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {COUNTRY_CODES.map((c) => (
                        <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                      ))}
                    </select>
                    <input
                      id="whatsapp-number"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                      disabled={whatsappOtpSent || loading}
                      placeholder="3XXXXXXXXX"
                      className="premium-input flex-1 disabled:opacity-70 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                {!whatsappOtpSent ? (
                  <button
                    type="button"
                    onClick={sendWhatsappOtp}
                    disabled={loading}
                    className="w-full btn-premium"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    <span>Verify with WhatsApp</span>
                  </button>
                ) : (
                  <div className="space-y-6 animate-slide-up">
                    <div className="space-y-2.5">
                      <label htmlFor="whatsapp-otp" className="block text-sm font-semibold text-on-surface-variant px-1">WhatsApp Code</label>
                      <input
                        id="whatsapp-otp"
                        type="text"
                        value={phoneOtp}
                        onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, ""))}
                        placeholder="000 000"
                        maxLength={6}
                        className="w-full h-12 text-center tracking-[0.6em] font-poppins font-semibold text-xl rounded-md bg-surface-container-high border border-outline-variant/20 focus:border-tertiary focus:ring-1 focus:ring-tertiary outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={verifyWhatsapp}
                      disabled={loading}
                      className="w-full btn-premium"
                    >
                      {loading ? "Verifying..." : "Confirm Code"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setWhatsappOtpSent(false)}
                      className="w-full py-2 text-xs font-semibold text-outline hover:text-on-surface transition-colors"
                    >
                      Use a different number
                    </button>
                  </div>
                )}
              </div>
            )}

            {stage === 4 && (
              <div className="space-y-3 text-center">
                <div className="w-12 h-12 rounded-md bg-green-500/10 text-green-600 grid place-items-center mx-auto">
                   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                     <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                   </svg>
                </div>
                <div>
                   <h2 className="text-lg font-poppins font-semibold mb-1">Application received</h2>
                   <p className="text-sm text-on-surface-variant leading-relaxed">
                     Thanks for joining Scientia Prep. We&apos;ll review your account and notify you when access is granted.
                   </p>
                </div>
                <Link href="/login" className="inline-flex w-full h-10 rounded-md bg-tertiary text-white text-sm font-poppins font-medium items-center justify-center hover:bg-tertiary/90 transition-colors">
                  Return to sign in
                </Link>
              </div>
            )}
          </div>

          {stage < 4 && (
             <div className="p-4 rounded-xl border border-outline-variant/10 bg-surface-container-low/50 text-xs text-on-surface-variant font-lora leading-relaxed">
                <p className="font-semibold mb-1 flex items-center gap-2">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  Registration Trouble?
                </p>
                <p>If you experience any lag or errors, please ensure your internet connection is stable and try disabling any browser extensions that might interfere with secure verification.</p>
             </div>
          )}
        </div>
      </main>

      <p className="text-center text-sm text-on-surface-variant font-medium">
        Already have an account?{" "}
        <Link href="/login" className="text-tertiary font-bold hover:underline ml-1">
          Sign In
        </Link>
      </p>

      <footer className="py-4 flex items-center justify-center gap-3 text-[10px] text-outline">
        <span>© {new Date().getFullYear()} {siteName}</span>
        <span className="w-1 h-1 rounded-full bg-outline/50" />
        <SupportForm />
      </footer>
    </div>
  );
}
