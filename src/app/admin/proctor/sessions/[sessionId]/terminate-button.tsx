"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { XCircle, Loader2 } from "lucide-react";

/**
 * Force-terminate an in-progress exam session. Wraps the existing
 * POST /api/admin/proctor/terminate route so the observer page can close
 * a session without sending the admin back to the proctor list.
 */
export function TerminateSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const onTerminate = async () => {
    setPending(true);
    const tid = toast.loading("Terminating session…");
    try {
      const res = await fetch("/api/admin/proctor/terminate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to terminate");
      toast.success("Session terminated", { id: tid });
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to terminate", { id: tid });
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      onClick={onTerminate}
      disabled={pending}
      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-red-500 text-white text-xs font-poppins font-medium hover:bg-red-600 disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <XCircle className="w-3.5 h-3.5" />
      )}
      Force terminate
    </button>
  );
}
