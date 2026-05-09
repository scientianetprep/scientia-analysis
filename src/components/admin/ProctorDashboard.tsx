"use client";

import { useEffect, useState } from "react";
import { createBrowserClientFn } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  ShieldAlert,
  ShieldCheck,
  Clock,
  Users,
  RefreshCw,
  XCircle,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";

type Session = {
  id: string;
  user_id: string;
  test_id: string;
  status: string;
  started_at: string;
  ended_at?: string | null;
  violation_count: number;
  candidate_name?: string;
  test_name?: string;
  latest_violation?: string;
  _flash?: boolean;
};

type Props = {
  initialSessions: Session[];
};

const STATUS_STYLE: Record<string, string> = {
  in_progress: "bg-green-500/10 text-green-600 border-green-500/20",
  submitted: "bg-outline/10 text-outline border-outline/20",
  timed_out: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  auto_submitted: "bg-red-500/10 text-red-600 border-red-500/20",
};

function elapsed(startedAt: string, endedAt?: string | null, status?: string) {
  // If the session is finished but we don't have an end time yet, 
  // don't let the clock "run wild" by defaulting to Date.now().
  if (status && status !== "in_progress" && !endedAt) {
    return "—";
  }
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const diffMs = end - new Date(startedAt).getTime();
  const m = Math.floor(diffMs / 60000);
  const s = Math.floor((diffMs % 60000) / 1000);
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export function ProctorDashboard({ initialSessions }: Props) {
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [, setTick] = useState(0);
  const [terminateSession, setTerminateSession] = useState<string | null>(null);
  const confirm = useConfirm();

  const supabase = createBrowserClientFn();

  useEffect(() => {
    const t = setInterval(() => setTick((p) => p + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const refreshSessions = async () => {
    const { data } = await supabase
      .from("exam_sessions")
      .select(
        `*, profiles!exam_sessions_user_profile_fkey(full_name), tests!exam_sessions_test_id_fkey(name)`
      )
      .order("started_at", { ascending: false });

    if (data) {
      setSessions(data.map((s: any) => ({
        ...s,
        candidate_name: s.profiles?.full_name,
        test_name: s.tests?.name,
      })));
    }
  };

  useEffect(() => {
    const channel = supabase
      .channel("proctor-live")
      // New session starts mid-view — pull the full row, not just payload.new,
      // so we get the joined candidate / test names.
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "exam_sessions" },
        async (payload: any) => {
          const sessionId = payload.new?.id;
          if (!sessionId) return;
          const { data } = await supabase
            .from("exam_sessions")
            .select(
              `*, profiles!exam_sessions_user_profile_fkey(full_name), tests!exam_sessions_test_id_fkey(name)`
            )
            .eq("id", sessionId)
            .single();
          if (!data) return;
          setSessions((prev) => {
            if (prev.some((s) => s.id === sessionId)) return prev;
            return [
              {
                ...data,
                candidate_name: data.profiles?.full_name,
                test_name: data.tests?.name,
              } as Session,
              ...prev,
            ];
          });
        }
      )
      // Status / violation-count updates on existing rows.
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "exam_sessions" },
        (payload: any) => {
          setSessions((prev) =>
            prev.map((s) => {
              if (s.id !== payload.new.id) return s;
              return {
                ...s,
                ...payload.new,
                candidate_name: s.candidate_name,
                test_name: s.test_name,
                _flash: false,
              };
            })
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "violations" },
        (payload: any) => {
          setSessions((prev) =>
            prev.map((s) => {
              if (s.id !== payload.new.session_id) return s;
              return {
                ...s,
                violation_count: (s.violation_count ?? 0) + 1,
                latest_violation: payload.new.violation_type,
                _flash: true,
              };
            })
          );
          setTimeout(() => {
            setSessions((prev) =>
              prev.map((s) =>
                s.id === payload.new.session_id ? { ...s, _flash: false } : s
              )
            );
          }, 2000);
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          toast.error("Real-time connection error. Refresh manually.");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const handleTerminate = async (sessionId: string) => {
    const tid = toast.loading("Terminating session…");
    try {
      const res = await fetch("/api/admin/proctor/terminate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) throw new Error("Failed to terminate");
      toast.success("Session terminated", { id: tid });
      setTerminateSession(null);
    } catch (err: any) {
      toast.error(err.message, { id: tid });
    }
  };

  const handleCleanupLogs = async () => {
    const ok = await confirm({
      title: "Clean completed logs?",
      description: "This will permanently delete all finished sessions and their answer history from the proctoring dashboard. Completed scores are not affected.",
      confirmLabel: "Clean logs",
      variant: "danger",
    });

    if (!ok) return;

    const tid = toast.loading("Cleaning logs...");
    try {
      const res = await fetch("/api/admin/proctor/cleanup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Cleanup failed");
      
      toast.success(`Cleaned ${data.deleted_count} completed sessions`, { id: tid });
      refreshSessions();
    } catch (err: any) {
      toast.error(err.message, { id: tid });
    }
  };

  const active = sessions.filter((s) => s.status === "in_progress");
  const completed = sessions.filter((s) => s.status !== "in_progress");

  const summary: Array<{ label: string; value: number; Icon: any; color: string }> = [
    { label: "Active", value: active.length, Icon: Users, color: "text-green-600" },
    { label: "Completed", value: completed.length, Icon: ShieldCheck, color: "text-outline" },
    { label: "Violations", value: sessions.reduce((s, sess) => s + (sess.violation_count ?? 0), 0), Icon: ShieldAlert, color: "text-red-600" },
    { label: "Total", value: sessions.length, Icon: RefreshCw, color: "text-tertiary" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-poppins font-semibold text-on-surface">Live sessions</h2>
          <p className="text-[11px] text-outline">Real-time monitoring of active candidates</p>
        </div>
        <div className="flex items-center gap-2">
          {completed.length > 0 && (
            <button
              onClick={handleCleanupLogs}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-red-500/20 bg-red-500/5 text-red-600 text-xs font-medium hover:bg-red-500 hover:text-white transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clean completed</span>
            </button>
          )}
          <button
            onClick={refreshSessions}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-outline-variant/20 bg-surface-container-high text-xs font-medium hover:bg-surface-container-highest"
          >
            <RefreshCw className="w-3.5 h-3.5 text-tertiary" />
            <span className="hidden sm:inline">Re-sync</span>
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {summary.map(({ label, value, Icon, color }) => (
          <div key={label} className="surface-card p-3 flex items-center gap-2.5">
            <Icon className={cn("w-4 h-4 shrink-0", color)} />
            <div>
              <p className="text-base font-poppins font-semibold text-on-surface leading-tight">{value}</p>
              <p className="text-[11px] text-outline">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Active sessions */}
      {active.length === 0 ? (
        <div className="surface-card p-6 text-center">
          <ShieldCheck className="w-6 h-6 text-green-600 mx-auto mb-1.5 opacity-70" />
          <p className="text-sm text-on-surface-variant">No active exam sessions right now.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] text-outline px-0.5">Active</p>
          <AnimatePresence initial={false}>
            {active.map((session) => (
              <motion.div
                key={session.id}
                layout
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className={cn(
                  "surface-card p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors",
                  session._flash && "border-red-500/40 bg-red-500/5",
                  session.violation_count > 0 && !session._flash && "border-yellow-500/20"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative shrink-0">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-40" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-on-surface truncate">
                      {session.candidate_name ?? "Candidate"}
                    </p>
                    <p className="text-[11px] text-outline truncate">
                      {session.test_name ?? session.test_id.slice(0, 12)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  <div className="inline-flex items-center gap-1 h-6 px-1.5 rounded-md text-[11px] text-on-surface-variant">
                    <Clock className="w-3 h-3" />
                    {elapsed(session.started_at, session.ended_at, session.status)}
                  </div>

                  {session.violation_count > 0 && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-medium border transition-colors",
                        session._flash
                          ? "bg-red-500 text-white border-red-500"
                          : "bg-red-500/10 text-red-600 border-red-500/20"
                      )}
                    >
                      <ShieldAlert className="w-3 h-3" />
                      {session.violation_count}
                    </span>
                  )}
                  {session.latest_violation && session._flash && (
                    <span className="text-[10px] font-medium text-red-500 capitalize">
                      {session.latest_violation.replace("_", " ")}
                    </span>
                  )}

                  <span
                    className={cn(
                      "inline-flex items-center h-5 px-2 rounded-md text-[10px] font-medium border capitalize",
                      STATUS_STYLE[session.status] ?? "bg-outline/10 text-outline border-outline/20"
                    )}
                  >
                    {session.status.replace("_", " ")}
                  </span>

                  <button
                    onClick={() => setTerminateSession(session.id)}
                    className="h-7 w-7 inline-flex items-center justify-center rounded-md bg-red-500/10 text-red-600 border border-red-500/20 hover:bg-red-500 hover:text-white"
                    title="Force terminate"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                  <a
                    href={`/admin/proctor/sessions/${session.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-7 w-7 inline-flex items-center justify-center rounded-md bg-tertiary/10 text-tertiary border border-tertiary/20 hover:bg-tertiary hover:text-white"
                    title="Open student session"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] text-outline px-0.5">Completed ({completed.length})</p>
          <div className="surface-card divide-y divide-outline-variant/10">
            {completed.slice(0, 20).map((session) => (
              <div key={session.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-on-surface truncate">
                    {session.candidate_name ?? "Candidate"}
                  </p>
                  <p className="text-[11px] text-outline truncate">{session.test_name ?? "—"}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] text-outline tabular-nums">
                    {elapsed(session.started_at, session.ended_at, session.status)}
                  </span>
                  {session.violation_count > 0 && (
                    <span className="text-[11px] text-red-600 font-medium">{session.violation_count}v</span>
                  )}
                  <span
                    className={cn(
                      "inline-flex items-center h-5 px-2 rounded-md text-[10px] font-medium border capitalize",
                      STATUS_STYLE[session.status] ?? "bg-outline/10 text-outline border-outline/20"
                    )}
                  >
                    {session.status.replace("_", " ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Terminate modal */}
      {terminateSession && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setTerminateSession(null)}
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
                <h3 className="text-sm font-poppins font-semibold text-on-surface">Force terminate</h3>
                <p className="text-[11px] text-on-surface-variant">This cannot be undone.</p>
              </div>
            </div>

            <p className="text-sm text-on-surface-variant mb-4 leading-relaxed">
              Immediately submit this student&apos;s exam?
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setTerminateSession(null)}
                className="h-8 px-3 rounded-md text-xs font-medium text-on-surface-variant hover:bg-surface-container-high"
              >
                Cancel
              </button>
              <button
                onClick={() => handleTerminate(terminateSession)}
                className="h-8 px-3 rounded-md text-xs font-medium bg-red-500 text-white hover:bg-red-600"
              >
                Terminate
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
