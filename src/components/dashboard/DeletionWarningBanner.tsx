"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { AlertTriangle, Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Shown on every dashboard page when the current user has
 * `profiles.deletion_scheduled_at` set (admin-approved deletion, 7-day grace).
 * Lets the student instantly revoke the deletion via /api/user/deletion/revoke.
 *
 * Placed directly under the page header in the dashboard layout so it's
 * visible on landing — satisfies the "login warning" requirement without
 * adding a full-screen gate (non-blocking).
 */
export function DeletionWarningBanner({ userId }: { userId?: string }) {
  const [deletionStatus, setDeletionStatus] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [dismissed, setDismissed] = useState(false);
 
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const supabase = createBrowserClient();
 
    (async () => {
      const { data } = await supabase
        .from("account_deletion_requests")
        .select("status, created_at")
        .eq("user_id", userId)
        .in("status", ["pending", "scheduled"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
 
      if (!alive) return;
      if (data) {
        setDeletionStatus(data.status);
      }
    })();
 
    return () => {
      alive = false;
    };
  }, [userId]);

  if (!deletionStatus || dismissed) return null;

  const handleRevoke = async () => {
    setRevoking(true);
    try {
      const res = await fetch("/api/user/deletion/revoke", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not cancel");
      toast.success("Deletion cancelled. Your account is fully restored.");
      setDismissed(true);
    } catch (err: any) {
      toast.error("Revoke failed", { description: err.message });
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div
      role="alert"
      className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 flex items-start gap-3"
    >
      <div className="w-8 h-8 rounded-md bg-red-500/20 grid place-items-center shrink-0">
        <AlertTriangle className="w-4 h-4 text-red-500" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-poppins font-semibold text-on-surface">
          Account deletion requested
        </h4>
        <p className="text-xs text-on-surface-variant leading-relaxed mt-0.5">
          {deletionStatus === "pending"
            ? "Your account deletion request is in queue for admin approval. Cancel now to keep full access to your data, scores, and certificates."
            : "Your account is scheduled for permanent deletion. Cancel now to keep full access to your data, scores, and certificates."}
        </p>
        <button
          onClick={handleRevoke}
          disabled={revoking}
          className="mt-2 h-8 px-3 rounded-md bg-red-500 text-white text-xs font-poppins font-medium inline-flex items-center gap-1.5 hover:bg-red-600 transition-colors disabled:opacity-50"
        >
          {revoking ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Undo2 className="w-3.5 h-3.5" />
          )}
          Cancel deletion request
        </button>
      </div>
    </div>
  );
}
