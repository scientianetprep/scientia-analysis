"use client";

import { useState, useTransition } from "react";
import { X, Save, AlertCircle, Calculator } from "lucide-react";
import { createBrowserClientFn } from "@/lib/supabase/client";
import { toast } from "sonner";

interface AcademicUpdateModalProps {
  onClose: () => void;
  userId: string;
  initialData?: Record<string, string | number | null>;
}

export function AcademicUpdateModal({ onClose, userId, initialData }: AcademicUpdateModalProps) {
  const [isPending, startTransition] = useTransition();
  const supabase = createBrowserClientFn();

  const [matricStatus, setMatricStatus] = useState(initialData?.matric_status || "Declared");
  const [matricObtained, setMatricObtained] = useState(initialData?.matric_marks || "");
  const [matricTotal, setMatricTotal] = useState(initialData?.matric_total || "1100");

  const [interStatus, setInterStatus] = useState(initialData?.intermediate_status || "Awaiting");
  const [interObtained, setInterObtained] = useState(initialData?.intermediate_marks || "");
  const [interTotal, setInterTotal] = useState(initialData?.intermediate_total || "1100");

  const calcPercentage = (obtained: string, total: string) => {
    const ob = parseFloat(obtained);
    const tot = parseFloat(total);
    if (!isNaN(ob) && !isNaN(tot) && tot > 0) {
      // Cap at 100% — obtained > total is self-reporting error, not extra credit.
      const pct = Math.min((ob / tot) * 100, 100);
      return pct.toFixed(2) + "%";
    }
    return "—";
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    // Root-cause validation: obtained must not exceed total on either record.
    const matricOb = parseFloat(String(matricObtained));
    const matricTot = parseFloat(String(matricTotal));
    const interOb = parseFloat(String(interObtained));
    const interTot = parseFloat(String(interTotal));
    if (matricStatus === "Declared" && !isNaN(matricOb) && !isNaN(matricTot) && matricOb > matricTot) {
      toast.error("Matric obtained cannot exceed total marks.");
      return;
    }
    if (interStatus === "Declared" && !isNaN(interOb) && !isNaN(interTot) && interOb > interTot) {
      toast.error("Intermediate obtained cannot exceed total marks.");
      return;
    }

    startTransition(async () => {
      const payload = {
        user_id: userId,
        matric_board: formData.get("matric_board"),
        matric_status: matricStatus,
        matric_marks: matricStatus === "Declared" ? matricObtained : null,
        matric_total: matricStatus === "Declared" ? matricTotal : null,
        intermediate_board: formData.get("inter_board"),
        intermediate_status: interStatus,
        intermediate_marks: interStatus === "Declared" ? interObtained : null,
        intermediate_total: interStatus === "Declared" ? interTotal : null,
      };

      const { error } = await supabase
        .from("academic_info")
        .upsert(payload, { onConflict: "user_id" });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Academic records updated.");
        window.location.reload();
      }
    });
  };

  const inputClass =
    "w-full h-9 px-3 rounded-md bg-surface-container-high border border-outline-variant/20 focus:border-tertiary focus:ring-1 focus:ring-tertiary outline-none text-sm transition-colors";
  const labelClass = "text-xs font-medium text-outline";

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-3 md:p-4 bg-surface/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-xl surface-card shadow-lg overflow-hidden my-4">
        <div className="px-4 md:px-5 py-3 border-b border-outline-variant/15 flex items-center justify-between sticky top-0 bg-surface-container-low z-10">
          <div>
            <h2 className="text-base md:text-lg font-poppins font-semibold text-on-surface">
              Update transcript
            </h2>
            <p className="text-xs text-on-surface-variant">
              Provide official self-reported academic metadata.
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-md grid place-items-center text-outline hover:bg-surface-container-high transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 md:px-5 py-4 space-y-4">
          {/* Matric */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
              <h3 className="text-xs font-poppins font-medium text-on-surface">
                Matriculation (SSC)
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className={labelClass}>Examination board</label>
                <input
                  name="matric_board"
                  defaultValue={(initialData?.matric_board as string) ?? ""}
                  required
                  className={inputClass}
                  placeholder="e.g. Federal Board"
                />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Status</label>
                <select
                  value={matricStatus}
                  onChange={(e) => setMatricStatus(e.target.value)}
                  className={`${inputClass} appearance-none`}
                >
                  <option value="Declared">Result declared</option>
                  <option value="Awaiting">Awaiting result</option>
                </select>
              </div>
            </div>

            {matricStatus === "Declared" && (
              <div className="grid grid-cols-3 gap-2 p-2.5 bg-surface-container-high rounded-md border border-outline-variant/15">
                <div className="space-y-1">
                  <label className={labelClass}>Obtained</label>
                  <input
                    type="number"
                    required
                    min={0}
                    max={Number(matricTotal) || undefined}
                    value={matricObtained}
                    onChange={(e) => setMatricObtained(e.target.value)}
                    className="w-full h-8 px-2 rounded-md bg-surface border border-outline-variant/20 outline-none text-sm focus:border-tertiary"
                  />
                </div>
                <div className="space-y-1">
                  <label className={labelClass}>Out of</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={matricTotal}
                    onChange={(e) => setMatricTotal(e.target.value)}
                    className="w-full h-8 px-2 rounded-md bg-surface border border-outline-variant/20 outline-none text-sm focus:border-tertiary"
                  />
                </div>
                <div className="space-y-1">
                  <label className={labelClass}>Percentage</label>
                  <div className="h-8 px-2 rounded-md bg-surface border border-outline-variant/15 flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5 text-tertiary" />
                    <span className="text-sm font-poppins font-medium text-on-surface">
                      {calcPercentage(String(matricObtained), String(matricTotal))}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Intermediate */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
              <h3 className="text-xs font-poppins font-medium text-on-surface">
                Intermediate (HSSC)
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className={labelClass}>Examination board</label>
                <input
                  name="inter_board"
                  defaultValue={(initialData?.intermediate_board as string) ?? ""}
                  required
                  className={inputClass}
                  placeholder="e.g. Federal Board"
                />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Status</label>
                <select
                  value={interStatus}
                  onChange={(e) => setInterStatus(e.target.value)}
                  className={`${inputClass} appearance-none`}
                >
                  <option value="Declared">Result declared</option>
                  <option value="Awaiting">Awaiting result</option>
                </select>
              </div>
            </div>

            {interStatus === "Declared" && (
              <div className="grid grid-cols-3 gap-2 p-2.5 bg-surface-container-high rounded-md border border-outline-variant/15">
                <div className="space-y-1">
                  <label className={labelClass}>Obtained</label>
                  <input
                    type="number"
                    required
                    min={0}
                    max={Number(interTotal) || undefined}
                    value={interObtained}
                    onChange={(e) => setInterObtained(e.target.value)}
                    className="w-full h-8 px-2 rounded-md bg-surface border border-outline-variant/20 outline-none text-sm focus:border-brand-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className={labelClass}>Out of</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={interTotal}
                    onChange={(e) => setInterTotal(e.target.value)}
                    className="w-full h-8 px-2 rounded-md bg-surface border border-outline-variant/20 outline-none text-sm focus:border-brand-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className={labelClass}>Percentage</label>
                  <div className="h-8 px-2 rounded-md bg-surface border border-outline-variant/15 flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5 text-brand-primary" />
                    <span className="text-sm font-poppins font-medium text-on-surface">
                      {calcPercentage(String(interObtained), String(interTotal))}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </section>

          <div className="flex items-start gap-2 p-2.5 bg-surface-container-high rounded-md border border-outline-variant/15">
            <AlertCircle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Fraudulent self-reported metrics will result in permanent expulsion from the Scientia
              enrollment program upon verification.
            </p>
          </div>

          <button
            disabled={isPending}
            type="submit"
            className="w-full h-10 bg-on-surface text-surface rounded-md font-poppins font-medium text-sm inline-flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isPending ? (
              "Saving…"
            ) : (
              <>
                <Save className="w-4 h-4" /> Save transcript
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
