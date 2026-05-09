"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Calculator,
  Save,
  AlertCircle,
  RefreshCcw,
  AlertTriangle,
} from "lucide-react";

export function AggregateFormulaBuilder() {
  const [weights, setWeights] = useState({
    matric: 0.1,
    inter: 0.4,
    test: 0.5,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showRecalculateConfirm, setShowRecalculateConfirm] = useState(false);

  const supabase = createBrowserClient();

  useEffect(() => {
    async function fetchSettings() {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "aggregate_formula")
        .single();

      if (data) {
        setWeights(data.value);
      }
      setLoading(false);
    }
    fetchSettings();
  }, [supabase]);

  const handleSave = async () => {
    const total = weights.matric + weights.inter + weights.test;
    if (Math.abs(total - 1.0) > 0.001) {
      toast.error(
        `Total weight must equal 100% (current: ${Math.round(total * 100)}%)`
      );
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("platform_settings").upsert({
      key: "aggregate_formula",
      value: weights,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      toast.error("Failed to save settings");
    } else {
      toast.success("Aggregate formula updated.");
    }
    setSaving(false);
  };

  const handleRecalculate = async () => {
    setShowRecalculateConfirm(false);
    const id = toast.loading("Recalculating all student ranks…");
    try {
      const res = await fetch("/api/admin/settings/recalculate", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message, { id, duration: 5000 });
    } catch (err: any) {
      toast.error(err.message, { id });
    }
  };

  if (loading) {
    return (
      <div className="surface-card p-4 flex items-center gap-2.5">
        <RefreshCcw className="w-4 h-4 text-tertiary animate-spin" />
        <p className="text-xs text-on-surface-variant">
          Loading configuration…
        </p>
      </div>
    );
  }

  const total = weights.matric + weights.inter + weights.test;
  const isInvalid = Math.abs(total - 1.0) > 0.001;

  return (
    <div className="surface-card overflow-hidden">
      <div className="p-4 border-b border-outline-variant/15 bg-surface-container-high/30 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-md bg-tertiary/10 flex items-center justify-center">
          <Calculator className="w-4 h-4 text-tertiary" />
        </div>
        <div>
          <h3 className="text-sm font-poppins font-semibold text-on-surface">
            Aggregate rank formula
          </h3>
          <p className="text-[11px] text-on-surface-variant">
            Define the weightage distribution for final performance calculation.
          </p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Matric */}
          <div className="space-y-1.5">
            <label className="block text-xs font-poppins font-medium text-outline">
              Matriculation (%)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={Math.round(weights.matric * 100)}
                onChange={(e) =>
                  setWeights({ ...weights, matric: Number(e.target.value) / 100 })
                }
                className="w-full h-9 pr-7 pl-3 rounded-md bg-surface-container-high border border-outline-variant/20 text-center text-sm font-poppins font-semibold text-tertiary outline-none focus:border-tertiary focus:ring-1 focus:ring-tertiary transition-colors"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-outline">
                %
              </span>
            </div>
          </div>

          {/* Inter */}
          <div className="space-y-1.5">
            <label className="block text-xs font-poppins font-medium text-outline">
              Intermediate (%)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={Math.round(weights.inter * 100)}
                onChange={(e) =>
                  setWeights({ ...weights, inter: Number(e.target.value) / 100 })
                }
                className="w-full h-9 pr-7 pl-3 rounded-md bg-surface-container-high border border-outline-variant/20 text-center text-sm font-poppins font-semibold text-tertiary outline-none focus:border-tertiary focus:ring-1 focus:ring-tertiary transition-colors"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-outline">
                %
              </span>
            </div>
          </div>

          {/* Test */}
          <div className="space-y-1.5">
            <label className="block text-xs font-poppins font-medium text-outline">
              Entry test (%)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={Math.round(weights.test * 100)}
                onChange={(e) =>
                  setWeights({ ...weights, test: Number(e.target.value) / 100 })
                }
                className="w-full h-9 pr-7 pl-3 rounded-md bg-surface-container-high border border-outline-variant/20 text-center text-sm font-poppins font-semibold text-tertiary outline-none focus:border-tertiary focus:ring-1 focus:ring-tertiary transition-colors"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-outline">
                %
              </span>
            </div>
          </div>
        </div>

        {/* Validation message */}
        <div
          className={`p-2.5 rounded-md flex items-center gap-2 text-xs font-poppins font-medium transition-colors ${
            isInvalid
              ? "bg-orange-500/10 border border-orange-500/20 text-orange-500"
              : "bg-green-500/10 border border-green-500/20 text-green-500"
          }`}
        >
          {isInvalid ? (
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          )}
          <span>
            Total distribution:{" "}
            <span className="tabular-nums">{Math.round(total * 100)}%</span>
            {isInvalid && " (must equal 100%)"}
            {!isInvalid && " (current formula is valid)"}
          </span>
        </div>

        {/* Preview */}
        <div className="p-3 bg-surface-container-highest/30 rounded-md border border-outline-variant/15 text-center space-y-1.5">
          <p className="text-[11px] font-poppins font-medium text-outline">
            Effective formula preview
          </p>
          <p className="text-sm md:text-base font-poppins font-semibold text-on-surface flex flex-wrap items-center justify-center gap-1.5">
            <span className="text-tertiary tabular-nums">
              ({Math.round(weights.matric * 100)}%)
            </span>
            <span className="opacity-40">M</span>
            <span className="text-outline">+</span>
            <span className="text-tertiary tabular-nums">
              ({Math.round(weights.inter * 100)}%)
            </span>
            <span className="opacity-40">I</span>
            <span className="text-outline">+</span>
            <span className="text-tertiary tabular-nums">
              ({Math.round(weights.test * 100)}%)
            </span>
            <span className="opacity-40">T</span>
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || isInvalid}
          className="w-full h-10 rounded-md bg-tertiary text-white text-sm font-poppins font-medium hover:bg-tertiary/90 transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
        >
          {saving ? (
            <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          Update platform formula
        </button>

        <button
          onClick={() => setShowRecalculateConfirm(true)}
          className="w-full h-9 rounded-md border border-outline-variant/20 bg-transparent text-on-surface-variant text-xs font-poppins font-medium hover:bg-surface-container-high transition-colors inline-flex items-center justify-center gap-2"
        >
          <RefreshCcw className="w-3.5 h-3.5" />
          Recalculate all students
        </button>
      </div>

      {/* Confirmation modal */}
      {showRecalculateConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-sm rounded-lg border border-orange-500/20 shadow-xl p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
              </div>
              <div>
                <h3 className="text-sm font-poppins font-semibold text-on-surface">
                  Recalculate all students
                </h3>
                <p className="text-[11px] text-on-surface-variant">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <p className="text-xs text-on-surface-variant mb-4 leading-relaxed">
              This will re-compute aggregate marks for all students based on the current formula. This may take a while for large datasets. Continue?
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowRecalculateConfirm(false)}
                className="h-8 px-3 rounded-md text-xs font-poppins font-medium text-on-surface-variant hover:bg-surface-container-highest transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRecalculate}
                className="h-8 px-3 rounded-md bg-orange-500 text-white text-xs font-poppins font-medium hover:bg-orange-600 inline-flex items-center gap-1.5 transition-colors"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                Yes, recalculate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
