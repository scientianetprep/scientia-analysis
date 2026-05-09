"use client";

import Link from "next/link";
import { useState } from "react";
import { format } from "date-fns";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  ShieldCheck,
  ShieldAlert,
  BookOpen,
  Receipt,
  GraduationCap,
  Activity,
  Clock,
  Coins,
} from "lucide-react";
import { CreditsEditor } from "@/components/admin/CreditsEditor";
import { cn } from "@/lib/utils";

type Tab = "profile" | "payments" | "sessions" | "enrollments" | "credits";

type Profile = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  username: string | null;
  cnic: string | null;
  whatsapp_number: string | null;
  city: string | null;
  role: string;
  status: string;
  mfa_enrolled: boolean;
  created_at: string;
  registration_stage: string | null;
  avatar_url: string | null;
};

type Payment = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string | null;
  receipt_id: string | null;
  notes: string | null;
  created_at: string;
};

type Session = {
  id: string;
  test_id: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  violation_count: number | null;
  tests?: { name: string } | null;
};

type Score = {
  id: string;
  test_id: string;
  correct_count: number;
  total_count: number;
  percentage: number | null;
  created_at: string;
  tests?: { name: string } | null;
};

type Grant = {
  id: string;
  course_id: string;
  is_active: boolean;
  access_tier: string | null;
  granted_at: string;
  revoked_at: string | null;
  courses?: { title: string } | null;
};

export function UserDetailClient({
  profile,
  academic,
  payments,
  sessions,
  scores,
  grants,
}: {
  profile: Profile;
  academic: Record<string, any> | null;
  payments: Payment[];
  sessions: Session[];
  scores: Score[];
  grants: Grant[];
}) {
  const [tab, setTab] = useState<Tab>("profile");

  const statusChip = (status: string) => {
    const map: Record<string, string> = {
      active: "bg-green-500/10 text-green-600",
      pending: "bg-amber-500/10 text-amber-600",
      suspended: "bg-red-500/10 text-red-600",
      scheduled_for_deletion: "bg-red-500/10 text-red-600",
    };
    return (
      <span
        className={cn(
          "inline-flex items-center h-5 px-2 rounded-md text-[10px] font-medium capitalize",
          map[status] || "bg-outline/10 text-outline"
        )}
      >
        {status.replace(/_/g, " ")}
      </span>
    );
  };

  const paymentColor = (s: string) => {
    if (s === "paid") return "bg-green-500/10 text-green-600";
    if (s === "pending") return "bg-amber-500/10 text-amber-600";
    if (s === "rejected" || s === "failed") return "bg-red-500/10 text-red-600";
    if (s === "refunded") return "bg-blue-500/10 text-blue-600";
    return "bg-outline/10 text-outline";
  };

  const tabs: Array<{ id: Tab; label: string; count?: number; icon: React.ElementType }> = [
    { id: "profile", label: "Profile", icon: Activity },
    { id: "payments", label: "Payments", count: payments.length, icon: Receipt },
    { id: "sessions", label: "Exam sessions", count: sessions.length, icon: ShieldAlert },
    { id: "enrollments", label: "Courses", count: grants.length, icon: BookOpen },
    { id: "credits", label: "Credits", icon: Coins },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/users"
            className="inline-flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Users
          </Link>
        </div>
      </div>

      {/* Summary card */}
      <div className="surface-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-tertiary/10 text-tertiary grid place-items-center font-poppins font-semibold text-base shrink-0">
          {(profile.full_name || profile.email || "?").slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-poppins font-semibold text-on-surface tracking-tight truncate">
              {profile.full_name || "Unnamed user"}
            </h1>
            {statusChip(profile.status)}
            <span className="inline-flex items-center h-5 px-2 rounded-md text-[10px] font-medium bg-tertiary/10 text-tertiary capitalize">
              {profile.role}
            </span>
            {profile.mfa_enrolled ? (
              <span
                className="inline-flex items-center gap-1 h-5 px-2 rounded-md text-[10px] font-medium bg-green-500/10 text-green-600"
                title="MFA enrolled"
              >
                <ShieldCheck className="w-3 h-3" />
                MFA
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1 h-5 px-2 rounded-md text-[10px] font-medium bg-outline/10 text-outline"
                title="MFA not enrolled"
              >
                <ShieldAlert className="w-3 h-3" />
                No MFA
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-on-surface-variant flex-wrap">
            {profile.email && (
              <span className="inline-flex items-center gap-1 min-w-0">
                <Mail className="w-3 h-3 shrink-0" />
                <span className="truncate">{profile.email}</span>
              </span>
            )}
            {profile.whatsapp_number && (
              <span className="inline-flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {profile.whatsapp_number}
              </span>
            )}
            {profile.city && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {profile.city}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Joined {format(new Date(profile.created_at), "MMM d, yyyy")}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="surface-card p-1.5 inline-flex gap-0.5 flex-wrap">
        {tabs.map(({ id, label, count, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "h-8 px-2.5 rounded text-xs font-medium inline-flex items-center gap-1.5 transition-colors",
              tab === id
                ? "bg-tertiary text-white"
                : "text-on-surface-variant hover:bg-surface-container-high"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {count !== undefined && (
              <span
                className={cn(
                  "inline-flex items-center justify-center min-w-[1.25rem] h-4 px-1 rounded-sm text-[10px]",
                  tab === id ? "bg-white/20 text-white" : "bg-surface-container-high text-outline"
                )}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Panels */}
      {tab === "profile" && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="surface-card p-4 space-y-2">
            <h2 className="text-sm font-poppins font-semibold text-on-surface">Identity</h2>
            <Row label="Username" value={profile.username} />
            <Row label="CNIC" value={profile.cnic} />
            <Row label="Registration stage" value={profile.registration_stage} />
            <Row
              label="Created"
              value={format(new Date(profile.created_at), "PPpp")}
            />
          </div>
          <div className="surface-card p-4 space-y-2">
            <h2 className="text-sm font-poppins font-semibold text-on-surface inline-flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-tertiary" />
              Academic
            </h2>
            {academic ? (
              <>
                <Row label="Matric board" value={academic.matric_board} />
                <Row
                  label="Matric marks"
                  value={
                    academic.matric_marks != null
                      ? `${academic.matric_marks}${
                          academic.matric_total ? ` / ${academic.matric_total}` : ""
                        }`
                      : null
                  }
                />
                <Row
                  label="Intermediate"
                  value={academic.intermediate_status ?? academic.intermediate_board}
                />
                <Row
                  label="Intermediate marks"
                  value={
                    academic.intermediate_marks != null
                      ? `${academic.intermediate_marks}${
                          academic.intermediate_total
                            ? ` / ${academic.intermediate_total}`
                            : ""
                        }`
                      : null
                  }
                />
              </>
            ) : (
              <p className="text-xs text-outline">Not submitted.</p>
            )}
          </div>
          <div className="surface-card p-4 md:col-span-2 space-y-2">
            <h2 className="text-sm font-poppins font-semibold text-on-surface">Recent scores</h2>
            {scores.length === 0 ? (
              <p className="text-xs text-outline">No scores yet.</p>
            ) : (
              <ul className="divide-y divide-outline-variant/10 text-sm">
                {scores.slice(0, 10).map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-1.5 gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-on-surface">
                        {s.tests?.name ?? s.test_id.slice(0, 8)}
                      </p>
                      <p className="text-[10px] text-outline">
                        {format(new Date(s.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-poppins font-semibold text-on-surface tabular-nums">
                        {s.percentage != null ? `${Math.round(Number(s.percentage))}%` : "—"}
                      </p>
                      <p className="text-[10px] text-outline">
                        {s.correct_count}/{s.total_count}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {tab === "payments" && (
        <section className="surface-card overflow-hidden">
          {payments.length === 0 ? (
            <div className="p-8 text-center text-sm text-outline">
              <CreditCard className="w-5 h-5 mx-auto mb-2 opacity-60" />
              No payments on record.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-container-high/60 text-xs text-outline">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Date</th>
                    <th className="px-3 py-2 text-left font-medium">Amount</th>
                    <th className="px-3 py-2 text-left font-medium">Method</th>
                    <th className="px-3 py-2 text-left font-medium">Receipt</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-surface-container-high/40">
                      <td className="px-3 py-2 text-[11px] text-outline whitespace-nowrap">
                        {format(new Date(p.created_at), "MMM d, yyyy")}
                      </td>
                      <td className="px-3 py-2 font-poppins font-semibold text-on-surface whitespace-nowrap">
                        {p.currency || "PKR"} {(p.amount || 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-xs text-on-surface-variant capitalize">
                        {(p.payment_method || "manual").replace(/_/g, " ")}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-outline font-mono">
                        {p.receipt_id || "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "inline-flex items-center h-5 px-2 rounded-md text-[10px] font-medium capitalize",
                            paymentColor(p.status)
                          )}
                        >
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === "sessions" && (
        <section className="surface-card overflow-hidden">
          {sessions.length === 0 ? (
            <div className="p-8 text-center text-sm text-outline">
              <ShieldAlert className="w-5 h-5 mx-auto mb-2 opacity-60" />
              No exam sessions yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-container-high/60 text-xs text-outline">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Started</th>
                    <th className="px-3 py-2 text-left font-medium">Test</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-left font-medium">Violations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {sessions.map((s) => (
                    <tr key={s.id} className="hover:bg-surface-container-high/40">
                      <td className="px-3 py-2 text-[11px] text-outline whitespace-nowrap">
                        {format(new Date(s.started_at), "MMM d, h:mm a")}
                      </td>
                      <td className="px-3 py-2 text-on-surface-variant truncate max-w-[200px]">
                        {s.tests?.name ?? s.test_id.slice(0, 8)}
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center h-5 px-2 rounded-md text-[10px] font-medium bg-outline/10 text-outline capitalize">
                          {s.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-[11px] font-medium",
                          (s.violation_count ?? 0) > 0 ? "text-red-600" : "text-outline"
                        )}
                      >
                        {s.violation_count ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === "enrollments" && (
        <section className="surface-card overflow-hidden">
          {grants.length === 0 ? (
            <div className="p-8 text-center text-sm text-outline">
              <BookOpen className="w-5 h-5 mx-auto mb-2 opacity-60" />
              No course access grants.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-container-high/60 text-xs text-outline">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Course</th>
                    <th className="px-3 py-2 text-left font-medium">Tier</th>
                    <th className="px-3 py-2 text-left font-medium">Granted</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {grants.map((g) => (
                    <tr key={g.id} className="hover:bg-surface-container-high/40">
                      <td className="px-3 py-2 text-on-surface-variant truncate max-w-[280px]">
                        {g.courses?.title ?? g.course_id.slice(0, 8)}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-outline capitalize">
                        {g.access_tier ?? "all"}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-outline whitespace-nowrap">
                        {format(new Date(g.granted_at), "MMM d, yyyy")}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "inline-flex items-center h-5 px-2 rounded-md text-[10px] font-medium",
                            g.is_active
                              ? "bg-green-500/10 text-green-600"
                              : "bg-red-500/10 text-red-600"
                          )}
                        >
                          {g.is_active ? "Active" : "Revoked"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === "credits" && (
        <section>
          <CreditsEditor userId={profile.user_id} />
        </section>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-xs">
      <span className="text-outline w-32 shrink-0">{label}</span>
      <span className="text-on-surface-variant break-words">{value ?? "—"}</span>
    </div>
  );
}
