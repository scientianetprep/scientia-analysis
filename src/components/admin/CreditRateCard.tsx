"use client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Coins } from "lucide-react";

export function CreditRateCard() {
  const [rate, setRate] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings/credit-rate")
      .then((r) => r.json())
      .then((d) => {
        setRate(d.pkr_per_credit);
        setInput(String(d.pkr_per_credit));
      });
  }, []);

  const save = async () => {
    const val = parseFloat(input);
    if (!val || val <= 0) {
      toast.error("Rate must be a positive number");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings/credit-rate", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pkr_per_credit: val }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setRate(val);
      toast.success("Exchange rate updated");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="surface-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-md bg-tertiary/10 grid place-items-center">
          <Coins className="w-4 h-4 text-tertiary" />
        </div>
        <div>
          <h3 className="text-sm font-poppins font-semibold text-on-surface">
            Credit Exchange Rate
          </h3>
          <p className="text-[11px] text-outline">
            How many PKR equals 1 credit.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-outline">
            PKR
          </span>
          <input
            type="number"
            min="1"
            step="0.01"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full pl-12 pr-3 h-9 rounded-md bg-surface-container-high border border-outline-variant/20 focus:border-tertiary focus:ring-1 focus:ring-tertiary outline-none text-sm [appearance:textfield]"
          />
        </div>
        <span className="text-sm text-outline">=</span>
        <span className="text-sm font-medium text-on-surface">1 credit</span>
        <button
          onClick={save}
          disabled={saving || input === String(rate)}
          className="h-9 px-4 rounded-md bg-tertiary text-white text-sm font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save
        </button>
      </div>
      {rate !== null && (
        <p className="text-[11px] text-outline">
          A payment of{" "}
          <span className="font-medium text-on-surface">PKR 5,000</span> will
          auto-convert to{" "}
          <span className="font-medium text-tertiary">
            {Math.floor(5000 / rate)} credits
          </span>
          .
        </p>
      )}
    </div>
  );
}
