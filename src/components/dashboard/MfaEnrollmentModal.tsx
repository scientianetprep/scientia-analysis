"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import { ShieldAlert, Loader2, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export function MfaEnrollmentModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const supabase = createBrowserClient();
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");

  useEffect(() => {
    // Clean out any previously-enrolled-but-unverified factors. Supabase errors
    // with `mfa_factor_name_conflict` if a stale unverified factor lingers,
    // which was the root cause of the enrollment loop.
    const cleanupUnverifiedFactors = async () => {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      // Supabase's types narrow status to "verified" but the runtime value
      // can also be "unverified" for half-enrolled factors — cast to compare.
      const stale = [
        ...(factors?.totp ?? []),
        ...(factors?.phone ?? []),
      ].filter((f) => (f.status as string) === "unverified");

      await Promise.all(
        stale.map((f) => supabase.auth.mfa.unenroll({ factorId: f.id }))
      );
    };

    const enrollOnce = () =>
      supabase.auth.mfa.enroll({
        factorType: "totp",
        issuer: "ScientiaNetPrep",
        friendlyName: `Authenticator-${Date.now()}`,
      });

    const startEnrollment = async () => {
      setLoading(true);
      await cleanupUnverifiedFactors();

      let { data, error } = await enrollOnce();

      // If something snuck in between our cleanup and enroll (e.g. another tab),
      // clean once more and retry.
      if (error && /factor.*name.*conflict|already exists/i.test(error.message)) {
        await cleanupUnverifiedFactors();
        ({ data, error } = await enrollOnce());
      }

      if (error || !data) {
        toast.error("Failed to initiate MFA", {
          description: error?.message ?? "Unknown error",
        });
        onClose();
        return;
      }

      setTotpUri(data.totp.uri);
      setTotpSecret(data.totp.secret);
      setFactorId(data.id);
      setLoading(false);
    };

    if (isOpen && !totpUri && !loading) {
      startEnrollment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, supabase.auth.mfa, onClose]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || verificationCode.length !== 6) {
      toast.error("Invalid code", {
        description: "Please enter the 6-digit code from your authenticator app.",
      });
      return;
    }

    setVerifying(true);

    const { data: challengeData, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId });

    if (challengeError) {
      toast.error("Failed to challenge MFA factor", {
        description: challengeError.message,
      });
      setVerifying(false);
      return;
    }

    const { data, error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code: verificationCode,
    });

    if (verifyError || !data || !data.access_token) {
      toast.error("Verification failed", {
        description:
          verifyError?.message ||
          "The code you entered is invalid or has expired.",
      });
      setVerifying(false);
      return;
    }

    // Update profile to mark MFA as enrolled
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("profiles")
        .update({ mfa_enrolled: true })
        .eq("user_id", user.id);
    }

    toast.success("Multi-factor authentication enabled");
    setVerifying(false);
    onSuccess();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        onClick={() => !verifying && onClose()}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-sm surface-card p-5 flex flex-col gap-3">
        <button
          onClick={onClose}
          disabled={verifying}
          className="absolute top-2.5 right-2.5 p-1.5 rounded-md hover:bg-surface-container-high transition-colors"
          aria-label="Close"
        >
          <X className="w-3.5 h-3.5 text-outline" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-md bg-brand-primary/10 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-4 h-4 text-brand-primary" />
          </div>
          <div>
            <h3 className="text-sm font-poppins font-semibold text-on-surface">
              Enable 2FA
            </h3>
            <p className="text-[11px] text-on-surface-variant">
              Secure your account
            </p>
          </div>
        </div>

        {loading || !totpUri ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-center">
            <Loader2 className="w-5 h-5 animate-spin text-tertiary" />
            <p className="text-xs text-outline">
              Generating secure credentials…
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2.5 text-center">
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Scan this QR code with your authenticator app (Google Authenticator, Authy, etc).
              </p>
              <div className="flex justify-center p-3 bg-white rounded-md mx-auto w-fit border border-outline-variant/15">
                <QRCodeSVG value={totpUri} size={160} />
              </div>
              {totpSecret && (
                <div className="pt-1">
                  <p className="text-[11px] font-poppins font-medium text-outline mb-1">
                    Or enter manual code
                  </p>
                  <code className="text-xs font-mono font-medium tracking-wider bg-surface-container-low px-2.5 py-1.5 rounded-md border border-outline-variant/15 select-all block break-all text-on-surface">
                    {totpSecret}
                  </code>
                </div>
              )}
            </div>

            <form onSubmit={handleVerify} className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-poppins font-medium text-on-surface-variant">
                  Verification code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) =>
                    setVerificationCode(e.target.value.replace(/\D/g, ""))
                  }
                  className="w-full text-center tracking-[0.6em] font-mono font-semibold text-lg h-12 rounded-md bg-surface-container-high border border-outline-variant/20 focus:border-tertiary focus:ring-1 focus:ring-tertiary outline-none transition-colors"
                  placeholder="000000"
                  inputMode="numeric"
                />
              </div>

              <button
                type="submit"
                disabled={verifying || verificationCode.length !== 6}
                className="w-full h-10 rounded-md bg-tertiary text-white text-sm font-poppins font-medium hover:bg-tertiary/90 transition-colors inline-flex justify-center items-center gap-2 disabled:opacity-50"
              >
                {verifying ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                Verify & enable
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
