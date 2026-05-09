"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Coins,
  Search,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  User,
  ShieldCheck,
  FileText,
  Calendar,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type TxStudent = { full_name: string; username: string; email: string } | null;

type Tx = {
  id: string;
  user_id: string;
  delta: number;
  reason: string;
  ref_id: string | null;
  ref_type: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
  student: TxStudent;
  performer: TxStudent;
  current_balance: number | null;
};

const REASON_LABELS: Record<string, string> = {
  admin_adjustment: "Manual Adjustment",
  payment_credit: "Payment Top-up",
  content_unlock: "Content Unlock",
  refund: "Refund",
  bonus: "Bonus",
  promotional: "Promotional",
  spend: "Content Spend",
};

const PAGE_SIZE = 60;

function DeltaBadge({ delta }: { delta: number }) {
  const isCredit = delta > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 h-6 rounded-full text-xs font-bold tabular-nums",
        isCredit
          ? "bg-green-500/10 text-green-600"
          : "bg-red-500/10 text-red-500"
      )}
    >
      {isCredit ? (
        <TrendingUp className="w-3 h-3" />
      ) : (
        <TrendingDown className="w-3 h-3" />
      )}
      {isCredit ? "+" : ""}
      {delta}
    </span>
  );
}

function StudentCell({ student, userId }: { student: TxStudent; userId: string }) {
  if (!student)
    return (
      <span className="text-xs text-outline font-mono">
        {userId.substring(0, 8)}…
      </span>
    );
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium text-on-surface truncate">{student.full_name}</div>
      <div className="text-[11px] text-outline truncate">{student.email}</div>
    </div>
  );
}

export default function AdminCreditsPage() {
  const [txns, setTxns] = useState<Tx[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const searchRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const fetch = useCallback(async (pg: number, q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pg) });
      if (q) params.set("search", q);
      const res = await window.fetch(`/api/admin/credits?${params}`);
      const data = await res.json();
      setTxns(data.transactions ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch(page, search);
  }, [fetch, page, search]);

  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => {
      setPage(0);
      setSearch(val);
    }, 350);
  };

  const totalCredits = txns.reduce((s, t) => s + (t.delta > 0 ? t.delta : 0), 0);
  const totalDebits = txns.reduce((s, t) => s + (t.delta < 0 ? Math.abs(t.delta) : 0), 0);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-poppins font-semibold text-on-surface tracking-tight">
            Credits
          </h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Full audit trail of every credit transaction across all students.
          </p>
        </div>
        <button
          onClick={() => fetch(page, search)}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-surface-container-high border border-outline-variant/20 text-xs font-medium text-on-surface hover:bg-surface-container-highest transition-colors"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          Refresh
        </button>
      </header>

      {/* Summary chips */}
      <div className="grid grid-cols-3 gap-3">
        <div className="surface-card p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-tertiary/10 flex items-center justify-center shrink-0">
            <Coins className="w-4 h-4 text-tertiary" />
          </div>
          <div>
            <div className="text-[11px] text-outline">Total Records</div>
            <div className="text-lg font-poppins font-bold text-on-surface tabular-nums">{total.toLocaleString()}</div>
          </div>
        </div>
        <div className="surface-card p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-green-500/10 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <div className="text-[11px] text-outline">Credits In (page)</div>
            <div className="text-lg font-poppins font-bold text-green-600 tabular-nums">+{totalCredits}</div>
          </div>
        </div>
        <div className="surface-card p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-red-500/10 flex items-center justify-center shrink-0">
            <TrendingDown className="w-4 h-4 text-red-500" />
          </div>
          <div>
            <div className="text-[11px] text-outline">Credits Out (page)</div>
            <div className="text-lg font-poppins font-bold text-red-500 tabular-nums">-{totalDebits}</div>
          </div>
        </div>
      </div>

      {/* Search + table */}
      <div className="surface-card overflow-hidden">
        <div className="p-3 border-b border-outline-variant/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-outline pointer-events-none" />
            <input
              type="text"
              placeholder="Search student name, email, reason, note…"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full h-9 pl-8 pr-3 rounded-md bg-surface-container-high border border-outline-variant/20 text-sm focus:outline-none focus:border-tertiary focus:ring-1 focus:ring-tertiary"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-16 flex items-center justify-center gap-2 text-outline text-sm">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Loading…
          </div>
        ) : txns.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center gap-2 text-outline">
            <AlertCircle className="w-6 h-6" />
            <span className="text-sm">No transactions found</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead>
                <tr className="bg-surface-container-high/60">
                  {[
                    "Student",
                    "Δ Credits",
                    "Reason",
                    "Content",
                    "Note",
                    "Performed By",
                    "Balance Now",
                    "Date",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-[11px] font-semibold text-outline uppercase tracking-wider whitespace-nowrap border-b border-outline-variant/10"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {txns.map((t, i) => (
                  <tr
                    key={t.id}
                    className={cn(
                      "hover:bg-surface-container-high/30 transition-colors",
                      i !== txns.length - 1 && "border-b border-outline-variant/8"
                    )}
                  >
                    {/* Student */}
                    <td className="px-3 py-2.5 min-w-[160px]">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-tertiary/10 flex items-center justify-center shrink-0">
                          <User className="w-3 h-3 text-tertiary" />
                        </div>
                        <StudentCell student={t.student} userId={t.user_id} />
                      </div>
                    </td>

                    {/* Delta */}
                    <td className="px-3 py-2.5">
                      <DeltaBadge delta={t.delta} />
                    </td>

                    {/* Reason */}
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1 text-xs text-on-surface-variant">
                        <Tag className="w-3 h-3 text-outline shrink-0" />
                        {REASON_LABELS[t.reason] ?? t.reason}
                      </span>
                    </td>

                    {/* Content ref */}
                    <td className="px-3 py-2.5">
                      {t.ref_type ? (
                        <span className="inline-flex items-center gap-1 text-xs text-on-surface-variant">
                          <FileText className="w-3 h-3 text-outline shrink-0" />
                          <span className="capitalize">{t.ref_type}</span>
                          {t.ref_id && (
                            <span className="text-outline font-mono">
                              #{t.ref_id.substring(0, 6)}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-outline text-xs">—</span>
                      )}
                    </td>

                    {/* Note */}
                    <td className="px-3 py-2.5 max-w-[200px]">
                      {t.note ? (
                        <span className="text-xs text-on-surface-variant truncate block" title={t.note}>
                          {t.note}
                        </span>
                      ) : (
                        <span className="text-outline text-xs">—</span>
                      )}
                    </td>

                    {/* Performer */}
                    <td className="px-3 py-2.5 min-w-[140px]">
                      {t.performer ? (
                        <div className="flex items-center gap-1.5">
                          <ShieldCheck className="w-3 h-3 text-tertiary shrink-0" />
                          <span className="text-xs text-on-surface-variant truncate">
                            {t.performer.full_name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-outline">System</span>
                      )}
                    </td>

                    {/* Current balance */}
                    <td className="px-3 py-2.5">
                      {t.current_balance != null ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-on-surface tabular-nums">
                          <Coins className="w-3 h-3 text-outline" />
                          {t.current_balance}
                        </span>
                      ) : (
                        <span className="text-outline text-xs">—</span>
                      )}
                    </td>

                    {/* Date */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-xs text-outline">
                        <Calendar className="w-3 h-3 shrink-0" />
                        {format(new Date(t.created_at), "dd MMM yyyy")}
                      </div>
                      <div className="text-[11px] text-outline/60 mt-0.5">
                        {format(new Date(t.created_at), "HH:mm")}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-3 py-2.5 border-t border-outline-variant/10 flex items-center justify-between">
            <span className="text-xs text-outline">
              Page {page + 1} of {totalPages} · {total} records
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="w-8 h-8 rounded-md flex items-center justify-center text-outline hover:bg-surface-container-high disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="w-8 h-8 rounded-md flex items-center justify-center text-outline hover:bg-surface-container-high disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
