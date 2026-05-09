"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Image from "next/image";
import { Loader2, Smartphone, MessageCircle, Award, AlertCircle } from "lucide-react";

export default function SetupMfaClient({
  userId,
  returnTo,
}: {
  userId: string;
  returnTo: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"select" | "totp-enrolled" | "totp-verify" | "whatsapp-enrolled" | "whatsapp-verify">("select");
  const [loadingMethod, setLoadingMethod] = useState<"totp" | "whatsapp" | "">("");
  const [error, setError] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [totpFactorId, setTotpFactorId] = useState<string | null>(null);

  const loading = loadingMethod !== "";

  // ── TOTP ────────────────────────────────────────────────────────────────────
  const enrollTotp = async () => {
    setLoadingMethod("totp");
    setError("");
    try {
      const res = await fetch("/api/auth/enroll-mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "totp" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start TOTP enrollment");
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setTotpFactorId(data.factorId || null);
      setStep("totp-enrolled");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to enroll";
      setError(message);
      toast.error(message);
    } finally {
      setLoadingMethod("");
    }
  };

  const verifyTotp = async () => {
    if (code.length !== 6) {
      toast.error("Invalid code", { description: "Please enter the 6-digit code." });
      return;
    }
    setLoadingMethod("totp");
    setError("");
    try {
      const res = await fetch("/api/auth/verify-enrollment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, method: "totp", factorId: totpFactorId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      toast.success("TOTP enabled successfully!");
      router.push(returnTo);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Verification failed";
      setError(message);
      toast.error(message);
    } finally {
      setLoadingMethod("");
    }
  };

  // ── WhatsApp ────────────────────────────────────────────────────────────────
  const enrollWhatsapp = async () => {
    setLoadingMethod("whatsapp");
    setError("");
    try {
      const res = await fetch("/api/auth/enroll-mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "whatsapp" }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.status === "ALREADY_VERIFIED") {
          toast.success("WhatsApp already verified");
          router.push(returnTo);
          return;
        }
        throw new Error(data.error || "Failed to send WhatsApp code");
      }
      setStep("whatsapp-enrolled");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send WhatsApp code";
      console.error("[UI] enrollWhatsapp error", err);
      setError(message);
      toast.error(message);
    } finally {
      setLoadingMethod("");
    }
  };

  const verifyWhatsapp = async () => {
    if (code.length !== 6) {
      toast.error("Invalid code", { description: "Please enter the 6-digit code." });
      return;
    }
    setLoadingMethod("whatsapp");
    setError("");
    try {
      const res = await fetch("/api/auth/verify-enrollment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, method: "whatsapp" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      toast.success("WhatsApp verified successfully!");
      router.push(returnTo);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Verification failed";
      setError(message);
      toast.error(message);
    } finally {
      setLoadingMethod("");
    }
  };

  const resendWhatsapp = async () => {
    setCode("");
    await enrollWhatsapp();
  };

  // ── Select method ──────────────────────────────────────────────────────────
  if (step === "select") {
    return (
      <div className="w-full max-w-sm mx-auto">
        <header className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-md bg-tertiary grid place-items-center overflow-hidden relative">
            <Image src="/icon-192.png" alt="Scientia" fill className="object-cover" sizes="32px" />
          </div>
          <span className="text-on-surface font-poppins font-semibold text-base">Scientia</span>
        </header>

        <div className="surface-card p-4 sm:p-5 space-y-3">
          <div>
            <h1 className="text-xl font-poppins font-semibold text-on-surface">Setup MFA</h1>
            <p className="text-sm text-on-surface-variant">Secure your account with two-factor authentication.</p>
          </div>

          {error && (
            <div className="py-2 px-3 rounded-md border border-red-500/20 bg-red-500/5 text-red-600 text-xs font-medium" role="alert" aria-live="polite">
              {error}
            </div>
          )}

           <div className="space-y-2">
             <button
               onClick={enrollTotp}
               disabled={loading}
               className="w-full h-10 rounded-md bg-tertiary text-white text-sm font-poppins font-medium inline-flex items-center justify-center gap-1.5 hover:bg-tertiary/90 disabled:opacity-50 transition-colors"
             >
               {loadingMethod === "totp" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
               Authenticator app (recommended)
             </button>

             <button
               onClick={enrollWhatsapp}
               disabled={loading}
               className="w-full h-10 rounded-md bg-surface-container-high border border-outline-variant/20 text-on-surface text-sm font-poppins font-medium inline-flex items-center justify-center gap-1.5 hover:bg-surface-container-highest disabled:opacity-50 transition-colors"
             >
               {loadingMethod === "whatsapp" ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
               WhatsApp
             </button>
           </div>
        </div>
      </div>
    );
  }

  // ── TOTP: show QR ──────────────────────────────────────────────────────────
  if (step === "totp-enrolled") {
    return (
      <div className="w-full max-w-sm mx-auto">
        <header className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-md bg-tertiary grid place-items-center overflow-hidden relative">
            <Image src="/icon-192.png" alt="Scientia" fill className="object-cover" sizes="32px" />
          </div>
          <span className="text-on-surface font-poppins font-semibold text-base">Scientia</span>
        </header>

        <div className="surface-card p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-tertiary/10 grid place-items-center shrink-0">
              <Smartphone className="w-4 h-4 text-tertiary" />
            </div>
            <div>
              <h2 className="text-base font-poppins font-semibold text-on-surface">Link Authenticator App</h2>
              <p className="text-[11px] text-on-surface-variant">Scan the QR code with Google Authenticator or Authy</p>
            </div>
          </div>

          {error && (
            <div className="py-2 px-3 rounded-md border border-red-500/20 bg-red-500/5 text-red-600 text-xs font-medium flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <div>{error}</div>
            </div>
          )}

          <div className="text-center py-2">
            {qrCode ? (
              <div className="inline-block p-2 bg-white rounded-md border border-outline-variant/15 my-2">
                <img src={qrCode} alt="QR Code" width={160} height={160} className="w-40 h-40" />
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 py-4">
                <Loader2 className="w-5 h-5 animate-spin text-tertiary" />
                <span className="text-xs text-outline">Generating QR code…</span>
              </div>
            )}
            {secret && (
              <p className="mt-2 text-[11px] text-on-surface-variant">
                Or enter manually:{" "}
                <code className="bg-surface-container-high px-1.5 py-0.5 rounded text-tertiary font-mono text-[10px] tracking-wider">{secret}</code>
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="totp-code" className="block text-xs font-medium text-on-surface-variant px-0.5">6-digit code</label>
            <input
              id="totp-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              maxLength={6}
              className="w-full h-12 text-center tracking-[0.6em] font-poppins font-semibold text-xl rounded-md bg-surface-container-high border border-outline-variant/20 focus:border-tertiary focus:ring-1 focus:ring-tertiary outline-none"
              inputMode="numeric"
              pattern="[0-9]*"
            />
          </div>

           <button
             onClick={verifyTotp}
             disabled={loading || code.length !== 6}
             className="w-full h-10 rounded-md bg-tertiary text-white text-sm font-poppins font-medium inline-flex items-center justify-center gap-1.5 hover:bg-tertiary/90 disabled:opacity-50 transition-colors"
           >
             {loadingMethod === "totp" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
             Verify & enable
           </button>
        </div>
      </div>
    );
  }

  // ── WhatsApp: code entry ───────────────────────────────────────────────────
  if (step === "whatsapp-enrolled") {
    return (
      <div className="w-full max-w-sm mx-auto">
        <header className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-md bg-tertiary grid place-items-center overflow-hidden relative">
            <Image src="/icon-192.png" alt="Scientia" fill className="object-cover" sizes="32px" />
          </div>
          <span className="text-on-surface font-poppins font-semibold text-base">Scientia</span>
        </header>

        <div className="surface-card p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#25D366]/10 grid place-items-center shrink-0">
              <MessageCircle className="w-4 h-4 text-[#25D366]" />
            </div>
            <div>
              <h2 className="text-base font-poppins font-semibold text-on-surface">WhatsApp Verification</h2>
              <p className="text-[11px] text-on-surface-variant">Enter the 6-digit code sent to your WhatsApp</p>
            </div>
          </div>

          {error && (
            <div className="py-2 px-3 rounded-md border border-red-500/20 bg-red-500/5 text-red-600 text-xs font-medium" role="alert">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="wa-code" className="block text-xs font-medium text-on-surface-variant px-0.5">6-digit code</label>
            <input
              id="wa-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              maxLength={6}
              className="w-full h-12 text-center tracking-[0.6em] font-poppins font-semibold text-xl rounded-md bg-surface-container-high border border-outline-variant/20 focus:border-tertiary focus:ring-1 focus:ring-tertiary outline-none"
              inputMode="numeric"
              pattern="[0-9]*"
            />
          </div>

           <button
             onClick={verifyWhatsapp}
             disabled={loading || code.length !== 6}
             className="w-full h-10 rounded-md bg-tertiary text-white text-sm font-poppins font-medium inline-flex items-center justify-center gap-1.5 hover:bg-tertiary/90 disabled:opacity-50 transition-colors"
           >
             {loadingMethod === "whatsapp" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
             Verify & enable
           </button>

          <button
            onClick={resendWhatsapp}
            disabled={loading}
            className="w-full py-2 text-xs font-semibold text-outline hover:text-on-surface transition-colors"
          >
            Didn&apos;t receive the code? Resend
          </button>
        </div>
      </div>
    );
  }

  return null;
}
