import "server-only";

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { format } from "date-fns";
import {
  ArrowLeft,
  Clock,
  ShieldAlert,
  CheckCircle2,
  CircleSlash,
  User as UserIcon,
  FileText,
} from "lucide-react";
import { TerminateSessionButton } from "./terminate-button";
import { SessionElapsed } from "./session-elapsed";

export const metadata = { title: "Exam session — Proctor" };
export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  in_progress: "bg-green-500/10 text-green-600 border-green-500/20",
  submitted: "bg-outline/10 text-outline border-outline/20",
  timed_out: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  auto_submitted: "bg-red-500/10 text-red-600 border-red-500/20",
};

export default async function ProctorSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  await requireAdmin();
  const { sessionId } = await params;

  // Admin observer view — read-only. Uses the service role so we bypass
  // the student-only RLS on exam_sessions / answers. This page is
  // registered under `/admin/...` so the dashboard layout's
  // "admins land on /admin" redirect doesn't fire here (which was why the
  // old "Open student session" link flashed and bounced to /admin).
  const admin = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: session, error } = await admin
    .from("exam_sessions")
    .select(
      `
      id,
      user_id,
      test_id,
      status,
      started_at,
      submitted_at,
      ended_at,
      time_remaining_s,
      violation_count,
      profiles:profiles!exam_sessions_user_profile_fkey(full_name, email, username),
      tests:tests!exam_sessions_test_id_fkey(id, name, subject, time_limit)
      `
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (error || !session) {
    return notFound();
  }

  const candidate = (session as any).profiles ?? null;
  const test = (session as any).tests ?? null;

  // Load the saved answers + violation log for the sidebar panels. These
  // are best-effort: an RLS denial or missing table is surfaced as an
  // empty list rather than breaking the page.
  const [answersRes, violationsRes] = await Promise.all([
    admin
      .from("exam_answers")
      .select("question_id, selected, is_flagged, answered_at")
      .eq("session_id", sessionId),
    admin
      .from("violations")
      .select("id, violation_type, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  const savedAnswers = answersRes.data ?? [];
  const violations = violationsRes.data ?? [];

  const isActive = session.status === "in_progress";
  const answered = savedAnswers.filter((a) => !!a.selected).length;
  const flagged = savedAnswers.filter((a) => a.is_flagged).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link
          href="/admin/proctor"
          className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Proctor
        </Link>
        {isActive && (
          <TerminateSessionButton sessionId={session.id} />
        )}
      </div>

      {/* Summary card */}
      <div className="surface-card p-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-tertiary/10 text-tertiary grid place-items-center font-poppins font-semibold shrink-0">
            <UserIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-poppins font-semibold text-on-surface truncate">
              {candidate?.full_name ?? "Unknown candidate"}
            </p>
            <p className="text-xs text-on-surface-variant truncate">
              {candidate?.email ?? session.user_id}
              {candidate?.username ? ` · @${candidate.username}` : ""}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center h-6 px-2 rounded-md text-[11px] font-medium border capitalize ${
            STATUS_STYLE[session.status] ?? "bg-outline/10 text-outline border-outline/20"
          }`}
        >
          {session.status.replace("_", " ")}
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <StatCard
          icon={<Clock className="w-4 h-4 text-tertiary" />}
          label={isActive ? "Elapsed" : "Duration"}
          value={
            <SessionElapsed
              startedAt={session.started_at}
              endedAt={session.ended_at ?? session.submitted_at ?? null}
              live={isActive}
            />
          }
        />
        <StatCard
          icon={<FileText className="w-4 h-4 text-brand-primary" />}
          label="Test"
          value={
            <span className="truncate block" title={test?.name ?? ""}>
              {test?.name ?? session.test_id.slice(0, 8)}
            </span>
          }
          valueClass="truncate"
        />
        <StatCard
          icon={<CheckCircle2 className="w-4 h-4 text-green-500" />}
          label="Answered"
          value={`${answered}${flagged > 0 ? ` · ${flagged} flagged` : ""}`}
        />
        <StatCard
          icon={<ShieldAlert className="w-4 h-4 text-red-500" />}
          label="Violations"
          value={String(session.violation_count ?? 0)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Violations log */}
        <div className="surface-card p-4 space-y-3">
          <h2 className="text-sm font-poppins font-semibold text-on-surface inline-flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-500" />
            Violations
          </h2>
          {violations.length === 0 ? (
            <p className="text-xs text-outline flex items-center gap-1.5">
              <CircleSlash className="w-3 h-3" />
              No violations recorded.
            </p>
          ) : (
            <ul className="divide-y divide-outline-variant/10 text-sm">
              {violations.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between py-1.5 gap-2"
                >
                  <span className="text-on-surface-variant capitalize">
                    {v.violation_type.replace(/_/g, " ")}
                  </span>
                  <span className="text-[11px] text-outline tabular-nums">
                    {format(new Date(v.created_at), "h:mm:ss a")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Session metadata */}
        <div className="surface-card p-4 space-y-2">
          <h2 className="text-sm font-poppins font-semibold text-on-surface">
            Session metadata
          </h2>
          <Row label="Session ID" value={session.id} mono />
          <Row label="Test ID" value={session.test_id} mono />
          <Row
            label="Started"
            value={format(new Date(session.started_at), "PPpp")}
          />
          {session.submitted_at && (
            <Row
              label="Submitted"
              value={format(new Date(session.submitted_at), "PPpp")}
            />
          )}
          {session.ended_at && session.ended_at !== session.submitted_at && (
            <Row
              label="Ended"
              value={format(new Date(session.ended_at), "PPpp")}
            />
          )}
          <Row
            label="Time remaining"
            value={
              session.time_remaining_s != null
                ? `${Math.floor(session.time_remaining_s / 60)}m ${
                    session.time_remaining_s % 60
                  }s`
                : "—"
            }
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="surface-card p-3 flex items-center gap-2.5">
      {icon}
      <div className="min-w-0">
        <p
          className={`text-sm font-poppins font-semibold text-on-surface leading-tight ${
            valueClass ?? ""
          }`}
        >
          {value}
        </p>
        <p className="text-[11px] text-outline">{label}</p>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 text-xs">
      <span className="text-outline w-28 shrink-0">{label}</span>
      <span
        className={`text-on-surface-variant break-all ${mono ? "font-mono" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
