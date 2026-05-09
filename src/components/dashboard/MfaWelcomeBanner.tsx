"use client";

import { useState } from "react";
import { Shield, X } from "lucide-react";
import { toast } from "sonner";

interface MfaWelcomeBannerProps {
  onDismiss: () => void;
}

export function MfaWelcomeBanner({ onDismiss }: MfaWelcomeBannerProps) {
  const [dismissing, setDismissing] = useState(false);

  const handleDismiss = async () => {
    setDismissing(true);
    try {
      const res = await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfa_prompt_dismissed: true }),
      });

      if (!res.ok) throw new Error("Failed to update preferences");

      onDismiss();
    } catch (err) {
      toast.error("Failed to dismiss prompt");
    } finally {
      setDismissing(false);
    }
  };

  return (
    <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-start gap-3">
      <Shield className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="font-poppins font-medium text-on-surface text-sm">
          Secure your account with MFA
        </p>
        <p className="text-on-surface-variant text-xs mt-0.5">
          Two-factor authentication takes about 30 seconds to set up.
        </p>
        <div className="flex gap-2 mt-2">
          <button
            onClick={handleDismiss}
            disabled={dismissing}
            className="h-7 px-2.5 rounded-md text-outline text-xs font-medium hover:text-on-surface hover:bg-amber-500/10 transition-colors disabled:opacity-50"
          >
            {dismissing ? "Saving…" : "Don't remind me again"}
          </button>
        </div>
      </div>
      <button
        onClick={handleDismiss}
        disabled={dismissing}
        className="text-outline hover:text-on-surface disabled:opacity-50 shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
