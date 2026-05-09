"use client";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Loader2, Plus, Minus, Coins } from "lucide-react";
import { cn } from "@/lib/utils";

type Txn = {
  id: string;
  delta: number;
  reason: string;
  note: string | null;
  created_at: string;
};

const REASON_LABELS: Record<string, string> = {
  manual_top_up: "Manual top-up",
  payment_conversion: "Payment conversion",
  content_unlock: "Content unlock",
  admin_adjustment: "Admin adjustment",
};

export function CreditsEditor({ userId }: { userId: string }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("manual_top_up");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/credits/${userId}`);
      const data = await res.json();
      if (res.ok) {
        setBalance(data.balance);
        setTxns(data.transactions);
      } else {
        toast.error(data.error);
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (sign: 1 | -1) => {
    const amount = parseInt(delta, 10);
    if (!amount || amount <= 0) {
      toast.error("Enter a positive credit amount");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          delta: sign * amount,
          reason,
          note: note || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(
        sign > 0 ? `+${amount} credits added` : `-${amount} credits deducted`
      );
      setDelta("");
      setNote("");
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="py-10 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-tertiary" />
      </div>
    );

  return (
    <div className="space-y-4">
      {/* Balance banner */}
      <div className="surface-card p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-md bg-tertiary/10 grid place-items-center shrink-0">
          <Coins className="w-5 h-5 text-tertiary" />
        </div>
        <div>
          <p className="text-2xl font-poppins font-bold text-on-surface">
            {(balance ?? 0).toLocaleString()}
          </p>
          <p className="text-xs text-outline">Current credit balance</p>
        </div>
      </div>

      {/* Adjustment form */}
      <div className="surface-card p-4 space-y-3">
        <h3 className="text-sm font-poppins font-semibold text-on-surface">
          Adjust credits
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-outline mb-1 block">Amount</label>
            <input
              type="number"
              min="1"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              placeholder="e.g. 500"
              className="w-full px-3 h-9 rounded-md bg-surface-container-high border border-outline-variant/20 focus:border-tertiary focus:ring-1 focus:ring-tertiary outline-none text-sm [appearance:textfield]"
            />
          </div>
          <div>
            <label className="text-[11px] text-outline mb-1 block">Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 h-9 rounded-md bg-surface-container-high border border-outline-variant/20 text-sm outline-none focus:border-tertiary focus:ring-1 focus:ring-tertiary"
            >
              <option value="manual_top_up">Manual top-up</option>
              <option value="admin_adjustment">Admin adjustment</option>
              <option value="payment_conversion">Payment conversion</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-[11px] text-outline mb-1 block">
            Note (optional)
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Bonus for referral"
            className="w-full px-3 h-9 rounded-md bg-surface-container-high border border-outline-variant/20 focus:border-tertiary focus:ring-1 focus:ring-tertiary outline-none text-sm"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => submit(1)}
            disabled={saving}
            className="h-9 px-4 rounded-md bg-green-500/10 text-green-600 text-sm font-medium hover:bg-green-500/20 inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            Add credits
          </button>
          <button
            onClick={() => submit(-1)}
            disabled={saving}
            className="h-9 px-4 rounded-md bg-red-500/10 text-red-600 text-sm font-medium hover:bg-red-500/20 inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Minus className="w-3.5 h-3.5" />
            )}
            Deduct
          </button>
        </div>
      </div>

      {/* Ledger */}
      <div className="surface-card overflow-hidden">
        <div className="px-4 py-2.5 border-b border-outline-variant/10">
          <h3 className="text-sm font-poppins font-semibold text-on-surface">
            Transaction history
          </h3>
        </div>
        {txns.length === 0 ? (
          <p className="p-6 text-center text-sm text-outline">
            No transactions yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-container-high/60 text-[11px] text-outline">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Date</th>
                <th className="px-3 py-2 text-left font-medium">Reason</th>
                <th className="px-3 py-2 text-left font-medium">Note</th>
                <th className="px-3 py-2 text-right font-medium">Delta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {txns.map((t) => (
                <tr key={t.id} className="hover:bg-surface-container-high/40">
                  <td className="px-3 py-2 text-[11px] text-outline whitespace-nowrap">
                    {format(new Date(t.created_at), "MMM d, HH:mm")}
                  </td>
                  <td className="px-3 py-2 text-xs text-on-surface-variant">
                    {REASON_LABELS[t.reason] ?? t.reason}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-outline truncate max-w-[160px]">
                    {t.note ?? "—"}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right font-poppins font-semibold tabular-nums",
                      t.delta > 0 ? "text-green-600" : "text-red-500"
                    )}
                  >
                    {t.delta > 0 ? `+${t.delta}` : t.delta}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
