"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  Coins,
  TrendingUp,
  TrendingDown,
  Tag,
  FileText,
  Calendar,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type Tx = {
  id: string;
  delta: number;
  reason: string;
  ref_id: string | null;
  ref_type: string | null;
  note: string | null;
  created_at: string;
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

function DeltaBadge({ delta }: { delta: number }) {
  const isCredit = delta > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 h-5 rounded-full text-[11px] font-bold tabular-nums shrink-0",
        isCredit ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-500"
      )}
    >
      {isCredit ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
      {isCredit ? "+" : ""}{delta}
    </span>
  );
}

export function CreditHistory() {
  const [txns, setTxns] = useState<Tx[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createBrowserClient();

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [txRes, balRes] = await Promise.all([
        supabase
          .from("credit_transactions")
          .select("id, delta, reason, ref_id, ref_type, note, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("credit_accounts")
          .select("balance")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      setTxns(txRes.data ?? []);
      setBalance(balRes.data?.balance ?? 0);
      setLoading(false);
    }
    load();
  }, [supabase]);

  const totalIn = txns.reduce((s, t) => s + (t.delta > 0 ? t.delta : 0), 0);
  const totalOut = txns.reduce((s, t) => s + (t.delta < 0 ? Math.abs(t.delta) : 0), 0);

  return (
    <div className="surface-card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-tertiary/10 grid place-items-center">
            <Coins className="w-3.5 h-3.5 text-tertiary" />
          </div>
          <div>
            <h3 className="text-base font-poppins font-semibold text-on-surface">Credit History</h3>
            <p className="text-xs text-outline">Your complete credit transaction log</p>
          </div>
        </div>
        {balance != null && (
          <div className="text-right">
            <div className="text-[11px] text-outline">Balance</div>
            <div className="text-lg font-poppins font-bold text-tertiary tabular-nums">
              {balance} <span className="text-xs font-normal text-outline">cr</span>
            </div>
          </div>
        )}
      </div>

      {/* Summary row */}
      {!loading && txns.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md bg-green-500/8 border border-green-500/15 px-3 py-2 flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-green-600 shrink-0" />
            <div>
              <div className="text-[11px] text-outline">Total earned</div>
              <div className="text-sm font-bold text-green-600 tabular-nums">+{totalIn} cr</div>
            </div>
          </div>
          <div className="rounded-md bg-red-500/8 border border-red-500/15 px-3 py-2 flex items-center gap-2">
            <TrendingDown className="w-3.5 h-3.5 text-red-500 shrink-0" />
            <div>
              <div className="text-[11px] text-outline">Total spent</div>
              <div className="text-sm font-bold text-red-500 tabular-nums">-{totalOut} cr</div>
            </div>
          </div>
        </div>
      )}

      {/* Transaction list */}
      {loading ? (
        <div className="py-8 flex items-center justify-center gap-2 text-outline text-sm">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Loading…
        </div>
      ) : txns.length === 0 ? (
        <div className="py-8 flex flex-col items-center gap-2 text-outline">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">No transactions yet</span>
        </div>
      ) : (
        <div className="divide-y divide-outline-variant/10">
          {txns.map((t) => (
            <div key={t.id} className="py-2.5 flex items-start gap-3">
              {/* Icon */}
              <div
                className={cn(
                  "mt-0.5 w-7 h-7 rounded-md flex items-center justify-center shrink-0",
                  t.delta > 0 ? "bg-green-500/10" : "bg-red-500/10"
                )}
              >
                {t.delta > 0 ? (
                  <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                )}
              </div>

              {/* Body */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-on-surface">
                    {REASON_LABELS[t.reason] ?? t.reason}
                  </span>
                  <DeltaBadge delta={t.delta} />
                </div>

                {/* Content ref */}
                {t.ref_type && (
                  <div className="flex items-center gap-1 mt-0.5 text-[11px] text-outline">
                    <FileText className="w-2.5 h-2.5 shrink-0" />
                    <span className="capitalize">{t.ref_type}</span>
                    {t.ref_id && (
                      <span className="font-mono">#{t.ref_id.substring(0, 8)}</span>
                    )}
                  </div>
                )}

                {/* Note */}
                {t.note && (
                  <div className="flex items-start gap-1 mt-0.5 text-[11px] text-on-surface-variant">
                    <Tag className="w-2.5 h-2.5 shrink-0 mt-px" />
                    <span className="truncate">{t.note}</span>
                  </div>
                )}
              </div>

              {/* Date */}
              <div className="text-right shrink-0">
                <div className="text-[11px] text-outline flex items-center gap-1">
                  <Calendar className="w-2.5 h-2.5" />
                  {format(new Date(t.created_at), "dd MMM yyyy")}
                </div>
                <div className="text-[10px] text-outline/60 mt-0.5">
                  {format(new Date(t.created_at), "HH:mm")}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
