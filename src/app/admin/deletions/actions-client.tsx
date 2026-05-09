"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Loader2 } from "lucide-react";

export function DeletionActionButtons({ request }: { request: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleAction = async (action: "approve" | "reject") => {
    if (action === "approve") {
      setShowConfirm(true);
      return;
    }

    setLoading(action);
    try {
      const res = await fetch("/api/admin/users/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: request.id, action, userId: request.user_id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success("Deletion request rejected. Account remains active.");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(null);
    }
  };

  const confirmDelete = async () => {
    setLoading("approve");
    setShowConfirm(false);
    try {
      const res = await fetch("/api/admin/users/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: request.id, action: "approve", userId: request.user_id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success("Deletion scheduled — grace window: 7 days.", {
        description: "The student will receive an email with a revoke link.",
      });
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <div className="flex items-center justify-end gap-1.5">
        <button
          onClick={() => handleAction("reject")}
          disabled={loading !== null}
          className="inline-flex items-center justify-center h-7 px-2.5 rounded-md text-[11px] font-medium text-on-surface-variant hover:bg-surface-container-high disabled:opacity-50"
        >
          {loading === "reject" ? "Processing…" : "Reject"}
        </button>
        <button
          onClick={() => handleAction("approve")}
          disabled={loading !== null}
          className="inline-flex items-center justify-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-medium bg-red-500/10 text-red-600 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50"
        >
          {loading === "approve" && <Loader2 className="w-3 h-3 animate-spin" />}
          Delete
        </button>
      </div>

      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface w-full max-w-sm rounded-lg border border-red-500/20 shadow-xl p-4"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded-md bg-red-500/10 grid place-items-center shrink-0">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                </div>
                <div>
                  <h3 className="text-sm font-poppins font-semibold text-on-surface">Schedule account deletion</h3>
                  <p className="text-[11px] text-on-surface-variant">7-day grace window before permanent removal.</p>
                </div>
              </div>

              <p className="text-sm text-on-surface-variant mb-4 leading-relaxed">
                Schedule <strong>{request.profiles?.full_name}</strong>&apos;s account for deletion in 7 days? The student will
                receive an email with a one-click revoke link. After the grace period a cron permanently purges their data.
              </p>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="h-8 px-3 rounded-md text-xs font-medium text-on-surface-variant hover:bg-surface-container-high"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={loading === "approve"}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                >
                  {loading === "approve" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Schedule deletion
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
